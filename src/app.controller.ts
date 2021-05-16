import {
  Controller,
  Get,
  HttpService,
  Logger,
  Query,
  Res,
} from '@nestjs/common';
import { AppService } from './app.service';
import { jwtVerify } from 'jose/jwt/verify';
import { createRemoteJWKSet } from 'jose/jwks/remote';
import { ConfigService } from '@nestjs/config';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);
  private AZURE_AD_TENANT_ID: string;
  private AZURE_AD_CLIENT_ID: string;
  private AZURE_AD_SECRET: string;
  private AZURE_AD_CALLBACK_URL: string;

  constructor(
    private appService: AppService,
    private httpService: HttpService,
    private configService: ConfigService,
  ) {
    this.AZURE_AD_TENANT_ID = this.configService.get('AZURE_AD_TENANT_ID');
    this.AZURE_AD_CLIENT_ID = this.configService.get('AZURE_AD_CLIENT_ID');
    this.AZURE_AD_SECRET = this.configService.get('AZURE_AD_SECRET');
    this.AZURE_AD_CALLBACK_URL = this.configService.get(
      'AZURE_AD_CALLBACK_URL',
    );
  }

  @Get()
  home(@Res() res) {
    this.logger.log(`Redirecting to Login page`);
    const authUrl =
      `https://login.microsoftonline.com/${this.AZURE_AD_TENANT_ID}/oauth2/v2.0/authorize` +
      `?client_id=${this.AZURE_AD_CLIENT_ID}` +
      `&response_type=code` +
      `&redirect_uri=${this.AZURE_AD_CALLBACK_URL}` +
      `&scope=openid profile email ${this.AZURE_AD_CLIENT_ID}/.default`;

    return res.redirect(authUrl);
  }

  @Get('/callback')
  async callback(@Query() query) {
    this.logger.log(`Getting token with auth_code=${query.code}`);
    const tokenUrl = `https://login.microsoftonline.com/${this.AZURE_AD_TENANT_ID}/oauth2/v2.0/token`;

    const params = new URLSearchParams();
    params.append('client_id', this.AZURE_AD_CLIENT_ID);
    params.append('grant_type', 'authorization_code');
    params.append('code', query.code);
    params.append('redirect_uri', this.AZURE_AD_CALLBACK_URL);
    params.append('client_secret', this.AZURE_AD_SECRET);
    // If not add ${this.AZURE_AD_CLIENT_ID}/.default to the scope, validation of access_token will fail "Invalid Signature"
    params.append(
      'scope',
      `openid profile email ${this.AZURE_AD_CLIENT_ID}/.default`,
    );

    const tokenRes = await this.httpService
      .post(tokenUrl, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      })
      .toPromise();

    const jwkSet = createRemoteJWKSet(
      new URL(
        `https://login.microsoftonline.com/${this.AZURE_AD_TENANT_ID}/discovery/v2.0/keys`,
      ),
    );
    let payload = await jwtVerify(tokenRes.data.id_token, jwkSet);
    this.logger.log(payload);

    payload = await jwtVerify(tokenRes.data.access_token, jwkSet);
    this.logger.log(payload);

    return tokenRes.data;
  }

  @Get('/helloworld')
  helloWorld() {
    return this.appService.getHello();
  }
}
