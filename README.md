# Hermes ⚡

A minimal HTTP framework inspired by Express.js, built with pure Node.js.  
Supports routing, middleware, sub-routers, and decorators for `req` and `res`.

---

## ✨ Features

- ✅ Method-based routing (GET, POST, PUT, PATCH, DELETE)
- ✅ Middleware chaining support
- ✅ Global middlewares (`app.use(...)`)
- ✅ Route prefix middlewares (`app.use('/admin', ...)`)
- ✅ Dynamic route parameters (`/users/:id`)
- ✅ Query string support (`?name=lucas`)
- ✅ Decorators: `res.status()`, `res.json()`, `res.send()`
- ✅ Sub-router support (`app.useRouter('/prefix', router)`)

---

## 🚀 Installation
```bash
npm install @theodorol/hermesjs
```

```js
import {Hermes} from "@theodorol/hermesjs";
const app = new Hermes();

app.get("/", (req, res) => {
  res.send("Hello from Hermes!");
});

app.listen(3000, () => {
  console.log("Server running");
});
```