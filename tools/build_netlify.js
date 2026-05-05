import * as esbuild from 'esbuild';

const bucketBaseUrl = process.env.R2_BUCKET_BASE_URL || '';

await esbuild.build ({
    entryPoints: ['source/website/index.js'],
    bundle: true,
    minify: true,
    globalName: 'OV',
    sourcemap: true,
    loader: { '.ttf': 'file', '.woff': 'file', '.svg': 'file' },
    outfile: 'build/website_dev/o3dv.website.min.js',
    define: {
        'BUCKET_BASE_URL': JSON.stringify (bucketBaseUrl),
    },
});
