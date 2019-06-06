import express from 'express';
import redis from 'redis';
import routers from './router/router';


const app = express();

//create and connect redis client
const client = redis.createClient();

// output redis errors to console
client.on('error', (err) => {
    console.log("error",err);
})

//Parse the request into body
app.use(express.json());

//Check if its working
app.get('/', (req, res) => res.send('App is working'));
 
app.use('/plan', routers);

const PORT = 3000;

app.listen(PORT, () => {
    console.log('server running on port 3000');
});

module.exports = {
    app
}
