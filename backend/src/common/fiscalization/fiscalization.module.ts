import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FiscalizationProvider } from './fiscalization-provider.interface';
import { FiscalizationSettings, createFiscalizationProvider } from './fiscalization.factory';
import { FiscalizationService } from './fiscalization.service';

@Global()
@Module({
  providers: [
    {
      provide: FiscalizationProvider,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => createFiscalizationProvider(config.get<FiscalizationSettings>('fiscalization')!),
    },
    FiscalizationService,
  ],
  exports: [FiscalizationProvider, FiscalizationService],
})
export class FiscalizationModule {}
