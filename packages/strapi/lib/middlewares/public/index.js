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

const utils = require('../../utils');

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
      const filename =
        strapi.config.environment === 'development' ? 'index' : 'production';
      const index = fs.readFileSync(
        path.join(staticDir, `${filename}.html`),
        'utf8'
      );

      const serveDynamicFiles = async ctx => {
        ctx.url = path.basename(`${ctx.url}/${filename}.html`);

        const isInitialised = await utils.isInitialised(strapi);

        // Template the expressions.
        const templatedIndex = await this.template(index, isInitialised);
        // Open stream to serve the file.
        const filestream = new stream.PassThrough();
        filestream.end(Buffer.from(templatedIndex));

        // Serve static.
        ctx.type = 'html';
        ctx.body = filestream;
      };

      // Serve /public index page.
      strapi.router.get('/', serveDynamicFiles);
      strapi.router.get('/(index.html|production.html)', serveDynamicFiles);

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

    template: async (data, isInitialised) => {
      // Allowed expressions to avoid data leaking.
      const allowedExpression = [
        'strapi.config.info.version',
        'strapi.config.info.name',
        'strapi.config.admin.url',
        'strapi.config.environment',
        'serverTime',
        'isInitialised',
      ];

      // Populate values to object.
      const objectWithValues = allowedExpression.reduce((acc, key) => {
        switch (key) {
          case 'serverTime':
            acc[key] = new Date().toUTCString();

            break;
          case 'isInitialised':
            acc[key] = isInitialised;

            break;
          default: {
            acc[key] = _.get(strapi, key.replace('strapi.', ''), '');
          }
        }

        return acc;
      }, {});

      const templatedIndex = _.template(data);

      return templatedIndex(objectWithValues);
    },
  };
};
