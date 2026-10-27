import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

const migrationId = 'gadoc-private-inline-files-v1';
interface Binding {
    _id: string;
    teamId: string;
    documentIds: string[];
}

export function legacyInlineKeys(content: string, teamId: string) {
    const normalized = content.replace(/%2f/gi, '/');
    return [
        ...new Set(
            normalized.match(/slacord\/docs\/[a-zA-Z0-9_-]+\/inline\/\d{4}-\d{2}-\d{2}\/[a-zA-Z0-9._-]+/g) ?? [],
        ),
    ].filter((key) => key.split('/')[2] === teamId);
}

@Injectable()
export class LegacyFileBindingsService implements OnApplicationBootstrap {
    constructor(@InjectConnection() private readonly connection: Connection) {}

    async onApplicationBootstrap() {
        const db = this.connection.db!;
        const migrations = db.collection<{ _id: string; completedAt: Date }>('application_migrations');
        if (await migrations.findOne({ _id: migrationId })) return;
        const bindings = db.collection<Binding>('legacy_file_bindings');
        // Snapshot current and historical references before accepting requests. Never rebind on reads.
        for (const name of ['documents', 'document_versions']) {
            const cursor = db
                .collection(name)
                .find({}, { projection: { _id: 1, documentId: 1, teamId: 1, content: 1 } });
            for await (const doc of cursor) {
                const documentId = String(name === 'documents' ? doc._id : doc.documentId);
                for (const key of legacyInlineKeys(doc.content ?? '', doc.teamId)) {
                    await bindings.updateOne(
                        { _id: key },
                        {
                            $setOnInsert: { teamId: doc.teamId },
                            $addToSet: { documentIds: documentId },
                        },
                        { upsert: true },
                    );
                }
            }
        }
        await migrations.updateOne({ _id: migrationId }, { $set: { completedAt: new Date() } }, { upsert: true });
    }

    async documentIds(key: string, teamId: string) {
        const binding = await this.connection
            .db!.collection<Binding>('legacy_file_bindings')
            .findOne({ _id: key, teamId });
        return binding?.documentIds ?? [];
    }
}
