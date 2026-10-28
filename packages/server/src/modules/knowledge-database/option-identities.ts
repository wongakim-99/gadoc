import { createHash, randomUUID } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { decodeOptionValue, encodeOptionValue, renameOptionIdentity, type OptionIdentity } from '@slacord/document-core';
import type { DatabaseProperty, PropertyValue } from './database.schema';

export const isOptionProperty = (property: Pick<DatabaseProperty, 'type'>) =>
    ['select', 'multi_select', 'status'].includes(property.type);

/** Stable even before an old schema has persisted its identity metadata. */
export function identitiesFor(property: DatabaseProperty): OptionIdentity[] {
    if (!isOptionProperty(property)) return [];
    if (property.optionIdentities) return property.optionIdentities.map((option) => ({ ...option }));
    const names = property.options ?? [];
    return names.map((name) => {
        let salt = 0;
        let id: string;
        do {
            id = 'opt_' + createHash('sha256').update(JSON.stringify([property.id, name, salt++])).digest('hex');
        } while (names.includes(id));
        return { id, name, legacyName: name };
    });
}

export function reconcileOptionIdentities(
    property: DatabaseProperty,
    names: readonly string[],
    renames: ReadonlyArray<{ id: string; name: string }> = [],
): OptionIdentity[] {
    let definitions = identitiesFor(property);
    if (new Set(renames.map((item) => item.id)).size !== renames.length)
        throw new BadRequestException('같은 선택 항목을 두 번 변경할 수 없습니다.');
    try {
        for (const rename of renames) definitions = renameOptionIdentity(definitions, rename.id, rename.name);
    } catch (error) {
        throw new BadRequestException((error as Error).message);
    }
    if (new Set(names).size !== names.length) throw new BadRequestException('선택 항목 이름이 중복됩니다.');
    return names.map((name) => definitions.find((item) => item.name === name) ?? { id: 'opt_' + randomUUID(), name });
}

export function optionStoredValue(property: DatabaseProperty, value: PropertyValue): PropertyValue {
    if (!isOptionProperty(property) || value === null) return value;
    const definitions = identitiesFor(property);
    const encode = (item: unknown) => {
        if (typeof item !== 'string') throw new BadRequestException('선택 항목을 확인하세요.');
        try { return encodeOptionValue(definitions, item); }
        catch { throw new BadRequestException('선택 항목을 확인하세요.'); }
    };
    return Array.isArray(value) ? value.map(encode) : encode(value);
}

export function optionDisplayValue(property: DatabaseProperty, value: PropertyValue): PropertyValue {
    if (!isOptionProperty(property) || value === null) return value;
    const definitions = identitiesFor(property);
    const decode = (item: string | number | boolean | null) =>
        typeof item === 'string' ? decodeOptionValue(definitions, item) : item;
    return Array.isArray(value) ? value.map(decode) : decode(value);
}
