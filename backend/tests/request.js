/**
 * Tiny HTTP test client so the suite has no supertest dependency.
 * Boots the app on an ephemeral port per request and returns { status, body }.
 */
const http = require('http');

function request(app) {
    const make = (method, path) => {
        let payload;
        let token;

        const thenable = {
            send(body) {
                payload = body;
                return thenable;
            },
            auth(bearer) {
                token = bearer;
                return thenable;
            },
            then(resolve, reject) {
                return execute().then(resolve, reject);
            },
        };

        const execute = () =>
            new Promise((resolve, reject) => {
                const server = http.createServer(app).listen(0, () => {
                    const { port } = server.address();
                    const data = payload === undefined ? null : JSON.stringify(payload);

                    const req = http.request(
                        {
                            host: '127.0.0.1',
                            port,
                            path,
                            method,
                            headers: {
                                ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
                                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                            },
                        },
                        (res) => {
                            let raw = '';
                            res.on('data', (c) => (raw += c));
                            res.on('end', () => {
                                server.close();
                                let body = {};
                                try {
                                    body = raw ? JSON.parse(raw) : {};
                                } catch {
                                    body = { raw };
                                }
                                resolve({ status: res.statusCode, body, headers: res.headers });
                            });
                        }
                    );

                    req.on('error', (err) => {
                        server.close();
                        reject(err);
                    });

                    if (data) req.write(data);
                    req.end();
                });
            });

        return thenable;
    };

    return {
        get: (p) => make('GET', p),
        post: (p) => make('POST', p),
        put: (p) => make('PUT', p),
        patch: (p) => make('PATCH', p),
        delete: (p) => make('DELETE', p),
    };
}

module.exports = request;
