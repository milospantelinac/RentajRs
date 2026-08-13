import { Global, Module } from '@nestjs/common';
import { FiscalizationProvider } from './fiscalization-provider.interface';
import { MockFiscalizationProvider } from './mock-fiscalization.provider';

@Global()
@Module({
  providers: [{ provide: FiscalizationProvider, useClass: MockFiscalizationProvider }],
  exports: [FiscalizationProvider],
})
export class FiscalizationModule {}
