import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'ChittyChat API',
      version: '1.0.0',
      description: 'AI-powered document intake and processing system with 1Password integration',
      contact: {
        name: 'ChittyChat Support',
        email: 'support@chittychat.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      },
      {
        url: 'https://api.chittychat.com',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        },
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key'
        }
      }
    }
  },
  apis: ['./src/routes/*.ts', './src/models/*.ts']
};

const swaggerSpec = swaggerJsdoc(options);

export const setupSwagger = (app: Express) => {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'ChittyChat API Documentation'
  }));
  
  // Serve OpenAPI spec as JSON
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
};

// API Documentation Examples

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - email
 *         - username
 *       properties:
 *         id:
 *           type: string
 *           description: User ID
 *         email:
 *           type: string
 *           format: email
 *           description: User email
 *         username:
 *           type: string
 *           description: Username
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     
 *     Document:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         filename:
 *           type: string
 *         mimeType:
 *           type: string
 *         size:
 *           type: number
 *         uploadedBy:
 *           type: string
 *         category:
 *           type: string
 *           enum: [contract, invoice, receipt, correspondence, legal, other]
 *         metadata:
 *           type: object
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *         aiAnalysis:
 *           $ref: '#/components/schemas/AIAnalysis'
 *     
 *     AIAnalysis:
 *       type: object
 *       properties:
 *         summary:
 *           type: string
 *         keyEntities:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *               value:
 *                 type: string
 *         sentiment:
 *           type: string
 *           enum: [positive, neutral, negative]
 *         confidence:
 *           type: number
 *           minimum: 0
 *           maximum: 1
 *     
 *     Error:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *         message:
 *           type: string
 *         code:
 *           type: string
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: User login
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Invalid credentials
 *       429:
 *         description: Too many attempts
 */

/**
 * @swagger
 * /api/documents:
 *   get:
 *     summary: List all documents
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [contract, invoice, receipt, correspondence, legal, other]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of documents
 *         headers:
 *           X-Total-Count:
 *             schema:
 *               type: integer
 *             description: Total number of documents
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Document'
 */

/**
 * @swagger
 * /api/documents/upload:
 *   post:
 *     summary: Upload a document
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               category:
 *                 type: string
 *                 enum: [contract, invoice, receipt, correspondence, legal, other]
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               metadata:
 *                 type: object
 *     responses:
 *       201:
 *         description: Document uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Document'
 *       400:
 *         description: Invalid file
 *       413:
 *         description: File too large
 */

/**
 * @swagger
 * /api/documents/{id}/analyze:
 *   post:
 *     summary: Analyze document with AI
 *     tags: [Documents, AI]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               analysisType:
 *                 type: string
 *                 enum: [summary, entities, sentiment, classification, all]
 *                 default: all
 *               model:
 *                 type: string
 *                 enum: [gpt-4, gpt-3.5-turbo]
 *                 default: gpt-4
 *     responses:
 *       200:
 *         description: Analysis complete
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AIAnalysis'
 *       404:
 *         description: Document not found
 *       429:
 *         description: AI rate limit exceeded
 */

/**
 * @swagger
 * /api/mcp/tools:
 *   get:
 *     summary: List available MCP tools
 *     tags: [MCP]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of MCP tools
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                   description:
 *                     type: string
 *                   parameters:
 *                     type: object
 */

/**
 * @swagger
 * /api/mcp/execute:
 *   post:
 *     summary: Execute MCP tool
 *     tags: [MCP]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tool
 *               - parameters
 *             properties:
 *               tool:
 *                 type: string
 *               parameters:
 *                 type: object
 *     responses:
 *       200:
 *         description: Tool execution result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 result:
 *                   type: object
 *                 error:
 *                   type: string
 */

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [System]
 *     responses:
 *       200:
 *         description: System is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [healthy, unhealthy]
 *                 services:
 *                   type: object
 *                   properties:
 *                     database:
 *                       type: object
 *                     redis:
 *                       type: object
 *                     storage:
 *                       type: object
 */

export default swaggerSpec;