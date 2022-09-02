import express from 'express';
import { GraphQLClient, gql } from 'graphql-request'
import axios from 'axios';

const IFTTT_KEY = process.env.IFTTT_KEY
const TOKEN = process.env.TIBBER_TOKEN
const TIME_ZONE = { timezone: 'Europe/Stockholm' }

const meanPrice = (priceInfos) => {
    let sum = 0
    priceInfos.forEach(priceInfo => {
        sum += priceInfo.total
    });
    return sum/priceInfos.length
}

const query = gql`
{
    viewer {
      homes {
        currentSubscription{
          priceInfo{
            current{
              total
              energy
              tax
              startsAt
              level
            }
            today {
              total
              energy
              tax
              startsAt
              level
            }
            tomorrow {
              total
              energy
              tax
              startsAt
              level
            }
          }
        }
      }
    }
  }
`

const fetchPrices = async () => {
  console.log('got new prices for the day', new Date())
  const d = await graphQLClient.request(query)
  return d
}

const endpoint = 'https://api.tibber.com/v1-beta/gql'

const graphQLClient = new GraphQLClient(endpoint, {
  headers: {
    authorization: TOKEN,
  },
})

const sendWebhook = ( data ) => {
  axios.post(`https://maker.ifttt.com/trigger/tibber_hour_price/json/with/key/${IFTTT_KEY}`, data)
      .then(res => {
        console.log(res.data)
      }).catch(error => {
        console.log(error)
      });
}

const app = express()
app.get('/', (req, res) => {
   res.send('hej');
})

const onPost = async () => {
  const data = await fetchPrices();
  const today = data.viewer.homes[0].currentSubscription.priceInfo.today
  const current = data.viewer.homes[0].currentSubscription.priceInfo.current
  const mean = meanPrice(today)

  if (current.total > mean) {
    console.log("above");
    sendWebhook( { current: current.total, level: current.level, mean: mean })
  } else {
    console.log('below');
  }

  return current.total + ' ' + current.level + ' ' + mean
}

app.post('/', async (req, res) => {
  const message = await onPost()
  console.log('resp', message)
  res.send(message)
})

app.listen(process.env.PORT || 3000)

console.log('Time to save some money')