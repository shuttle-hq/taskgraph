const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');


const Schema = mongoose.Schema;

// ===== Express Setup =====

const app = express();
const port = 3001;

app.use(cors());
app.use(bodyParser.json());

// ===== Mongo/ose Setup =====
mongoose.Promise = global.Promise;
mongoose.connect('mongodb://localhost:27017/taskgraph').then(r => {
    console.log('MongoDB connected');
});
const GraphSchema = new Schema({}, {strict: false});
const GraphModel = mongoose.model('Graph', GraphSchema);

// ===== Endpoints Setup =====

app.post('/state', (req, res) => {
    let graph = req.body;
    const timeStampedGraph = {
        time: Date.now(),
        graph: graph,
    };
    const thing = new GraphModel(timeStampedGraph);

    thing
        .save()
        .then(r => {
            res.sendStatus(200);
        })
        .catch(err => {
            // 422 is Unprocessed Entity, so the POST failed
            res.sendStatus(422);
        });
});
app.get('/state', (req, res) => {

    GraphModel.findOne()
        .sort('-time')
        .exec(function (err, model) {
            if (err) {
                console.err(err);
                res.sendStatus(500);
            } else {
                // Hacky hacky hack because I don't want to define a schema yet
                if (model == null) {
                    res.sendStatus(404);
                } else {
                    let graph = JSON.parse(JSON.stringify(model)).graph;
                    res.json(graph);
                }
            }
        });
});

app.listen(port, () =>
    console.log(`TaskGraph server listening on port ${port}!`)
);
