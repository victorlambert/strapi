'use strict';

/**
 * Module dependencies
 */

// Node.js core.
const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const koaStatic = require('koa-static');
const stream = require('stream');

/**
 * Public assets hook
 */

module.exports = strapi => {
  return {
    /**
     * Initialize the hook
     */

    initialize() {
      const { maxAge } = strapi.config.middleware.settings.public;

      const staticDir = path.resolve(
        strapi.dir,
        strapi.config.middleware.settings.public.path ||
          strapi.config.paths.static
      );

      // Open the file.
      const index = fs.readFileSync(path.join(staticDir, 'index.html'), 'utf8');

      // Serve /public index page.
      strapi.router.get('/', async ctx => {
        ctx.url = path.basename(`${ctx.url}/index.html`);
        // Template the expressions.
        const templatedIndex = this.template(index);
        // Open stream to serve the file.
        const filestream = new stream.PassThrough();
        filestream.end(Buffer.from(templatedIndex));

        // Serve static.
        ctx.type = 'html';
        ctx.body = filestream;
      });

      // Match every route with an extension.
      // The file without extension will not be served.
      // Note: This route could be override by the user.
      strapi.router.get(
        '/*',
        async (ctx, next) => {
          const parse = path.parse(ctx.url);
          ctx.url = path.join(parse.dir, parse.base);

          await next();
        },
        koaStatic(staticDir, {
          maxage: maxAge,
          defer: true,
        })
      );

      if (!strapi.config.serveAdminPanel) return;

      const basename = _.get(
        strapi.config.currentEnvironment.server,
        'admin.path'
      )
        ? strapi.config.currentEnvironment.server.admin.path
        : '/admin';

      const buildDir = path.resolve(strapi.dir, 'build');

      // Serve /admin index page.
      strapi.router.get(
        basename,
        async (ctx, next) => {
          ctx.url = 'index.html';
          await next();
        },
        koaStatic(buildDir, {
          maxage: maxAge,
          defer: true,
        })
      );

      // Allow refresh in admin page.
      strapi.router.get(
        `${basename}/*`,
        async (ctx, next) => {
          const parse = path.parse(ctx.url);

          if (parse.ext === '') {
            ctx.url = 'index.html';
          }

          await next();
        },
        koaStatic(buildDir, {
          maxage: maxAge,
          defer: true,
        })
      );

      // Serve admin assets.
      strapi.router.get(
        `${basename}/*.*`,
        async (ctx, next) => {
          ctx.url = path.basename(ctx.url);

          await next();
        },
        koaStatic(buildDir, {
          maxage: maxAge,
          defer: true,
        })
      );
    },

    template: data => {
      // Allowed expressions to avoid data leaking.
      const allowedExpression = [
        'strapi.config.info.version',
        'strapi.config.info.name',
        'strapi.config.admin.url',
      ];

      // Templating function.
      const templatedIndex = data.replace(/{%(.*?)%}/g, expression => {
        const sanitizedExpression = expression.replace(/{% | %}/g, '');

        if (allowedExpression.includes(sanitizedExpression)) {
          return _.get(strapi, sanitizedExpression.replace('strapi.', ''), '');
        }

        return '';
      });

      return templatedIndex;
    },
  };
};
