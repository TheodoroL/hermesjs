import { createServer } from "node:http";
import { match } from "path-to-regexp";

export class Hermes {
    #routes = new Map();
    #middlewaresForAll = [];

    get(path, ...handlers) {
        this.#addRoute("GET", path, handlers);
    }
    post(path, ...handlers) {
        this.#addRoute("POST", path, handlers);
    }
    put(path, ...handlers) {
        this.#addRoute("PUT", path, handlers);
    }
    delete(path, ...handlers) {
        this.#addRoute("DELETE", path, handlers);
    }
    patch(path, ...handlers) {
        this.#addRoute("PATCH", path, handlers);
    }

    #addRoute(method, path, handlers) {
        const key = `${method} ${path}`;
        const existing = this.#routes.get(key) || [];
        this.#routes.set(key, [...existing, ...handlers]);
    }

    getRoutes() {
        return this.#routes;
    }

    getMiddlewaresForAll() {
        return this.#middlewaresForAll;
    }

    matchRoute(url, method) {
        for (const [key, handlers] of this.#routes.entries()) {
            const [routeMethod, routePath] = key.split(" ");
            if (routeMethod !== method) continue;

            const urlMatch = match(routePath, { decode: decodeURIComponent });
            const result = urlMatch(url);
            if (result) {
                return { handlers, params: result.params };
            }
        }
        return null;
    }

    async invokeMiddlewares(req, res, middlewares) {
        if (!middlewares.length) return;
        const [current, ...rest] = middlewares;
        await current(req, res, () => this.invokeMiddlewares(req, res, rest));
    }

    requestDecorator(request, response, next) {
        request.params = request.params || {};
        request.query = request.query || {};

        const urlParams = request.url.split('/').slice(1);

        // Remove query string do último segmento
        const [lastParam, queryString] = urlParams[urlParams.length - 1].split('?');
        urlParams.splice(urlParams.length - 1, 1);

        const allParams = [...urlParams, lastParam].join('/');

        // Monta URL para matching com método
        const fullUrlWithMethod = `/${allParams}/${request.method.toUpperCase()}`;

        for (const path of this.#routes.keys()) {
            const urlMatch = match(path, { decode: decodeURIComponent });
            const found = urlMatch(fullUrlWithMethod);
            if (found) {
                Object.keys(found.params).forEach(key => {
                    request.params[key] = found.params[key];
                });
                break;
            }
        }

        // Parseia query string
        if (queryString) {
            const params = new URLSearchParams(queryString);
            for (const [key, value] of params.entries()) {
                request.query[key] = value;
            }
        }

        next();
    }

    ResponseDecorator(req, res, next) {
        res.status = function (statusCode) {
            this.statusCode = statusCode;
            return this;
        };

        res.json = function (data) {
            this.setHeader('Content-Type', 'application/json');
            this.end(JSON.stringify(data));
        };

        res.send = function (data) {
            this.end(data);
        };

        next();
    }

    use(pathOrMiddleware, ...middlewares) {
        if (typeof pathOrMiddleware === "string") {
            // Middleware por prefixo de rota
            const path = pathOrMiddleware;
            for (const [key, handlers] of this.#routes.entries()) {
                const [, routePath] = key.split(" ");
                if (routePath.startsWith(path)) {
                    this.#routes.set(key, [...middlewares, ...handlers]);
                }
            }
        } else {
            this.#middlewaresForAll.push(pathOrMiddleware, ...middlewares);
        }
    }

    /**
     * Monta sub-router em um prefixo.
     * @param {string} path prefixo base para o sub-router (ex: "/api")
     * @param {Hermes} router outro app Hermes
     */
    useRouter(path, router) {
        if (typeof router.getRoutes !== "function" || typeof router.getMiddlewaresForAll !== "function") {
            throw new Error("O router passado deve ter métodos getRoutes() e getMiddlewaresForAll()");
        }

        const routerRoutes = router.getRoutes();
        const routerMiddlewares = router.getMiddlewaresForAll();

        for (const [key, handlers] of routerRoutes.entries()) {
            // key = "METHOD /path"
            const [method, subPath] = key.split(" ");

            // concatena o path base + caminho do subrouter (garantindo uma / só)
            const fullPath = path.endsWith("/")
                ? path.slice(0, -1) + subPath
                : path + subPath;

            const existingHandlers = this.#routes.get(`${method} ${fullPath}`) || [];

            this.#routes.set(
                `${method} ${fullPath}`,
                [...existingHandlers, ...routerMiddlewares, ...handlers]
            );
        }
    }

    async serverHandler(req, res) {
        const pathname = req.url.split('?')[0];
        const match = this.matchRoute(pathname, req.method);
        if (!match) {
            res.statusCode = 404;
            res.end('Not found');
            return;
        }

        req.params = match.params || {};

        const middlewares = [
            this.requestDecorator.bind(this),
            this.ResponseDecorator.bind(this),
            ...this.#middlewaresForAll,
            ...match.handlers,
        ];

        await this.invokeMiddlewares(req, res, middlewares);
    }

    listen(port, callback) {
        const server = createServer(this.serverHandler.bind(this));
        server.listen(port, callback);
    }
}