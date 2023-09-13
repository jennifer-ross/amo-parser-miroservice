import { Test, TestingModule } from '@nestjs/testing';
import { AppClusterService } from './app-cluster.service';

describe('AppClusterService', () => {
  let service: AppClusterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AppClusterService],
    }).compile();

    service = module.get<AppClusterService>(AppClusterService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
