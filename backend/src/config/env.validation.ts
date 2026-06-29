import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  validateSync,
} from 'class-validator';
import { normalizeOriginUrl } from './configuration';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  JWT_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_SECRET!: string;

  @IsString()
  @IsOptional()
  TELEGRAM_BOT_TOKEN?: string;

  @IsUrl({ require_tld: false })
  @IsOptional()
  WEBHOOK_URL?: string;

  @IsUrl({ require_tld: false })
  @IsOptional()
  FRONTEND_URL?: string;

  @IsUrl({ require_tld: false })
  @IsOptional()
  BACKEND_URL?: string;
}

export function validate(config: Record<string, unknown>) {
  const normalizedConfig = { ...config };

  if (typeof normalizedConfig.FRONTEND_URL === 'string') {
    normalizedConfig.FRONTEND_URL = normalizeOriginUrl(
      normalizedConfig.FRONTEND_URL,
      normalizedConfig.FRONTEND_URL,
    );
  }

  const validatedConfig = plainToInstance(EnvironmentVariables, normalizedConfig, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validatedConfig;
}
