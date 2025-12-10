const express = require('express');
const promClient = require('prom-client');
const bodyParser = require('body-parser');

const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON body
app.use(bodyParser.json());

// -----------------------------
//  Prometheus Metrics Setup
// -----------------------------
const collectDefaultMetrics = promClient.collectDefaultMetrics;
collectDefaultMetrics(); // collects CPU, memory, event loop metrics, etc.

const httpRequestCounter = new promClient.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status'],
});

const httpRequestDuration = new promClient.Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration histogram',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.1, 0.3, 0.5, 1, 2, 5]
});

// Middleware to record metrics
app.use((req, res, next) => {
    const end = httpRequestDuration.startTimer();
    res.on('finish', () => {
        httpRequestCounter.inc({ method: req.method, route: req.path, status: res.statusCode });
        end({ method: req.method, route: req.path, status: res.statusCode });
    });
    next();
});

// -----------------------------
//  In-memory Data
// -----------------------------
let items = [];

// -----------------------------
//  Endpoints
// -----------------------------

// Root endpoint
app.get('/', (req, res) => {
    res.send('Hello from Node.js App with Metrics!');
});

// GET /items
app.get('/items', (req, res) => {
    res.json({
        success: true,
        data: items
    });
});

// POST /items
app.post('/items', (req, res) => {
    const item = req.body;

    if (!item || !item.name) {
        return res.status(400).json({
            success: false,
            message: "Item must have a 'name' field"
        });
    }

    items.push(item);

    res.status(201).json({
        success: true,
        message: "Item added",
        data: item
    });
});

// Prometheus Metrics Endpoint
app.get('/metrics', async (req, res) => {
    try {
        res.set('Content-Type', promClient.register.contentType);
        res.end(await promClient.register.metrics());
    } catch (err) {
        res.status(500).end(err);
    }
});

// -----------------------------
//  Start Server
// -----------------------------
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
