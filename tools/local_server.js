import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const port = parseInt(process.env.PORT || '8081', 10);

const mimeTypes = new Map([
    ['.html', 'text/html; charset=utf-8'],
    ['.js', 'text/javascript; charset=utf-8'],
    ['.css', 'text/css; charset=utf-8'],
    ['.json', 'application/json; charset=utf-8'],
    ['.png', 'image/png'],
    ['.jpg', 'image/jpeg'],
    ['.jpeg', 'image/jpeg'],
    ['.svg', 'image/svg+xml'],
    ['.ico', 'image/x-icon'],
    ['.ttf', 'font/ttf'],
    ['.woff', 'font/woff'],
    ['.glb', 'model/gltf-binary'],
    ['.gltf', 'model/gltf+json'],
    ['.bin', 'application/octet-stream']
]);

function SendText(response, statusCode, text) {
    response.writeHead(statusCode, {
        'Content-Type': 'text/plain; charset=utf-8'
    });
    response.end(text);
}

function GetContentType(filePath) {
    return mimeTypes.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream';
}

function ServeFile(request, response, filePath) {
    fs.stat(filePath, (statError, stat) => {
        if (statError !== null || !stat.isFile()) {
            SendText(response, 404, 'Not found');
            return;
        }

        response.writeHead(200, {
            'Content-Type': GetContentType(filePath),
            'Content-Length': stat.size
        });
        if (request.method === 'HEAD') {
            response.end();
            return;
        }
        fs.createReadStream(filePath).pipe(response);
    });
}

function ServeStaticFile(request, requestUrl, response) {
    let decodedPath = decodeURIComponent(requestUrl.pathname);
    if (decodedPath === '/') {
        decodedPath = '/website/';
    }
    if (decodedPath.endsWith('/')) {
        decodedPath += 'index.html';
    }

    let filePath = path.resolve(rootDir, '.' + decodedPath);
    if (!filePath.startsWith(rootDir + path.sep) && filePath !== rootDir) {
        SendText(response, 403, 'Forbidden');
        return;
    }

    ServeFile(request, response, filePath);
}

function ServeLocalModel(request, requestUrl, response) {
    let modelPath = requestUrl.searchParams.get('path');
    if (modelPath === null || modelPath.length === 0) {
        SendText(response, 400, 'Missing path parameter');
        return;
    }

    ServeFile(request, response, path.resolve(modelPath));
}

const server = http.createServer((request, response) => {
    let requestUrl = new URL(request.url, `http://${request.headers.host}`);
    if (request.method !== 'GET' && request.method !== 'HEAD') {
        SendText(response, 405, 'Method not allowed');
        return;
    }

    if (requestUrl.pathname === '/local-model') {
        ServeLocalModel(request, requestUrl, response);
        return;
    }

    ServeStaticFile(request, requestUrl, response);
});

server.listen(port, '127.0.0.1', () => {
    console.log(`Online3DViewer local server running at http://127.0.0.1:${port}/website/`);
});
