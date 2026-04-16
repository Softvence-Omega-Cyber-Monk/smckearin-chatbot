import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for WebSocket and HTTP
  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type'],
  });

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('SMC Chatbot API')
    .setDescription('API documentation for SMC Chatbot with real-time Socket.IO support')
    .setVersion('1.0')
    .addTag('Chat', 'Real-time chat endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 3000);
  console.log(`Application is running on: http://localhost:${process.env.PORT ?? 3000}/api`);
  console.log(`WebSocket connection available at: ws://localhost:${process.env.PORT ?? 3000}`);
}
bootstrap();
