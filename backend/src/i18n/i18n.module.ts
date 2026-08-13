import { Module } from '@nestjs/common';
import { AcceptLanguageResolver, HeaderResolver, I18nModule, QueryResolver } from 'nestjs-i18n';
import * as path from 'path';

/**
 * sr is the only language actually shown in v1 (R138); en exists so
 * translations are a content task later, not a code change (R139).
 *
 * Path is resolved from process.cwd() (the container/process WORKDIR, where
 * the top-level `i18n/` directory lives beside `src`/`dist`) rather than
 * __dirname, so it works identically under `nest start --watch` (ts-node,
 * cwd = backend/) and the compiled `dist/main.js` (cwd = /app in the
 * production image) without juggling relative-to-dist bookkeeping.
 */
@Module({
  imports: [
    I18nModule.forRoot({
      fallbackLanguage: 'sr',
      loaderOptions: {
        path: path.join(process.cwd(), 'i18n'),
        watch: process.env.NODE_ENV !== 'production',
      },
      resolvers: [new QueryResolver(['lang']), new HeaderResolver(['x-lang']), AcceptLanguageResolver],
    }),
  ],
  exports: [I18nModule],
})
export class AppI18nModule {}
