import { BadRequestException } from '@nestjs/common';
import { documentColumnConfig, documentColumnsConfig } from '@slacord/document-core';

export function documentStateBytes(value: unknown): Buffer | undefined {
    if (value == null) return undefined;
    if (value instanceof Uint8Array) return Buffer.from(value);
    // Mongoose lean() returns BSON Binary, not its declared Buffer field type.
    const binary = value as { buffer?: Uint8Array; position?: number };
    if (binary.buffer instanceof Uint8Array)
        return Buffer.from(binary.buffer.subarray(0, binary.position ?? binary.buffer.length));
    throw new BadRequestException('공동 편집 저장 형식을 읽을 수 없습니다.');
}

export class DocumentCodec {
    private static pending: Promise<void> = Promise.resolve();
    private initialized?: ReturnType<DocumentCodec['initialize']>;
    private async initialize() {
        // Keep BlockNote and Yjs on one ESM graph; their CJS constructors differ.
        const [{ ServerBlockNoteEditor }, core, Y] = await Promise.all([
            import('@blocknote/server-util'),
            import('@blocknote/core'),
            import('yjs'),
        ]);
        const database = core.createBlockSpec(
            {
                type: 'database',
                propSchema: { databaseId: { default: '' }, viewState: { default: '' }, linked: { default: false } },
                content: 'none',
            },
            { render: () => ({ dom: globalThis.document.createElement('div') }) },
        );
        const layoutRender = { render: () => ({ dom: globalThis.document.createElement('div') }) };
        const columns = core.createBlockSpec(documentColumnsConfig, layoutRender);
        const column = core.createBlockSpec(documentColumnConfig, layoutRender);
        const schema = core.BlockNoteSchema.create({ blockSpecs: {
            ...core.defaultBlockSpecs, database: database(), documentColumns: columns(), documentColumn: column(),
        } });
        return { editor: ServerBlockNoteEditor.create({ schema }), Y };
    }
    process(input: Parameters<DocumentCodec['convert']>[0]) {
        // ServerBlockNoteEditor temporarily installs a global DOM during imports.
        const result = DocumentCodec.pending.then(() => this.convert(input));
        DocumentCodec.pending = result.then(
            () => undefined,
            () => undefined,
        );
        return result;
    }
    private async convert(input: {
        state?: Buffer;
        content: string;
        contentFormat: 'plain' | 'html' | 'json';
        update?: Uint8Array;
        replacement?: { content: string; contentFormat: 'plain' | 'html' | 'json' };
    }) {
        this.initialized ??= this.initialize();
        const { editor, Y } = await this.initialized;
        const doc = new Y.Doc();
        try {
            const parse = async (content: string, format: string) => {
                const blocks =
                    format === 'json'
                        ? JSON.parse(content || '[]')
                        : format === 'html'
                          ? await editor.tryParseHTMLToBlocks(content)
                          : await editor.tryParseMarkdownToBlocks(content);
                if (!Array.isArray(blocks) || blocks.length > 5000) throw new Error('Invalid blocks');
                return blocks.length ? blocks : [{ type: 'paragraph', content: [] }];
            };
            const storedState = documentStateBytes(input.state);
            if (storedState?.length) Y.applyUpdate(doc, storedState);
            else
                await editor.blocksToYXmlFragment(
                    await parse(input.content, input.contentFormat),
                    doc.getXmlFragment('document-store'),
                );
            const vector = Y.encodeStateVector(doc);
            if (input.update) Y.applyUpdate(doc, input.update);
            if (input.replacement)
                await editor.blocksToYXmlFragment(
                    await parse(input.replacement.content, input.replacement.contentFormat),
                    doc.getXmlFragment('document-store'),
                );
            const content = JSON.stringify(await editor.yDocToBlocks(doc, 'document-store'));
            const state = Buffer.from(Y.encodeStateAsUpdate(doc));
            if (Buffer.byteLength(content) > 2 * 1024 * 1024 || state.length > 4 * 1024 * 1024)
                throw new Error('Document limit');
            return { state, content, delta: Buffer.from(Y.encodeStateAsUpdate(doc, vector)) };
        } catch {
            throw new BadRequestException('공동 편집 데이터를 처리하지 못했습니다. 원본은 변경하지 않았습니다.');
        } finally {
            doc.destroy();
        }
    }
}
