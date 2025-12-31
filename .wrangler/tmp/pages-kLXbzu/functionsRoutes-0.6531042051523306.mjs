import { onRequestPost as __api_auth___path___js_onRequestPost } from "D:\\AAA\\libre\\LibreTV\\functions\\api\\auth\\[[path]].js"
import { onRequest as __api_user_js_onRequest } from "D:\\AAA\\libre\\LibreTV\\functions\\api\\user.js"
import { onRequest as __proxy___path___js_onRequest } from "D:\\AAA\\libre\\LibreTV\\functions\\proxy\\[[path]].js"
import { onRequest as ___middleware_js_onRequest } from "D:\\AAA\\libre\\LibreTV\\functions\\_middleware.js"

export const routes = [
    {
      routePath: "/api/auth/:path*",
      mountPath: "/api/auth",
      method: "POST",
      middlewares: [],
      modules: [__api_auth___path___js_onRequestPost],
    },
  {
      routePath: "/api/user",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_user_js_onRequest],
    },
  {
      routePath: "/proxy/:path*",
      mountPath: "/proxy",
      method: "",
      middlewares: [],
      modules: [__proxy___path___js_onRequest],
    },
  {
      routePath: "/",
      mountPath: "/",
      method: "",
      middlewares: [___middleware_js_onRequest],
      modules: [],
    },
  ]