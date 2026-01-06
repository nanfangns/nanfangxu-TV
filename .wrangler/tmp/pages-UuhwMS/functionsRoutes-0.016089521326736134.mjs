import { onRequest as __api_admin_stats_js_onRequest } from "D:\\AAA\\libre\\LibreTV\\functions\\api\\admin\\stats.js"
import { onRequest as __api_admin_users_js_onRequest } from "D:\\AAA\\libre\\LibreTV\\functions\\api\\admin\\users.js"
import { onRequest as __api_user_sync_js_onRequest } from "D:\\AAA\\libre\\LibreTV\\functions\\api\\user\\sync.js"
import { onRequestPost as __api_auth___path___js_onRequestPost } from "D:\\AAA\\libre\\LibreTV\\functions\\api\\auth\\[[path]].js"
import { onRequest as __proxy___path___js_onRequest } from "D:\\AAA\\libre\\LibreTV\\functions\\proxy\\[[path]].js"
import { onRequest as ___middleware_js_onRequest } from "D:\\AAA\\libre\\LibreTV\\functions\\_middleware.js"

export const routes = [
    {
      routePath: "/api/admin/stats",
      mountPath: "/api/admin",
      method: "",
      middlewares: [],
      modules: [__api_admin_stats_js_onRequest],
    },
  {
      routePath: "/api/admin/users",
      mountPath: "/api/admin",
      method: "",
      middlewares: [],
      modules: [__api_admin_users_js_onRequest],
    },
  {
      routePath: "/api/user/sync",
      mountPath: "/api/user",
      method: "",
      middlewares: [],
      modules: [__api_user_sync_js_onRequest],
    },
  {
      routePath: "/api/auth/:path*",
      mountPath: "/api/auth",
      method: "POST",
      middlewares: [],
      modules: [__api_auth___path___js_onRequestPost],
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