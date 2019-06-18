import express from 'express';
import router from './router/router';


const app = express();

//Parse the request into body
app.use(express.json());

//Set strong etag
// app.enable('etag');
app.set('etag','strong');

//Check if its working
app.get('/', (req, res) => res.send('App is working'));
 
app.use('/', router);

const PORT = 3000;

app.listen(PORT, () => {
    console.log('server running on port 3000');
});

module.exports = {
    app
}
