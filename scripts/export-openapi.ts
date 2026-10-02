import { mkdir, writeFile } from 'node:fs/promises';
import router from '../src/router/router';
import { documentConfig } from '../src/openapi/document';
async function main() {
    await mkdir('build', { recursive: true });
    await writeFile(
        'build/openapi.json',
        JSON.stringify(router.getOpenAPIDocument(documentConfig), null, 2) + '\n',
    );
    console.log('Exported build/openapi.json');
}
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
