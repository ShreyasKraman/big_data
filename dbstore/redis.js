import redis from 'redis';
import {error} from '../utils/response';

let client;

export const getRedisClient = () => {
    if(client){
        return client;
    }else{
        client = redis.createClient();

        // output redis errors to console
        client.on('error', (err) => {
            console.log(err);
        });

        return client;
    }

}
