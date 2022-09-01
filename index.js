import http from 'http';
import { GraphQLClient, gql } from 'graphql-request'
import { schedule } from 'node-cron'

const TOKEN = process.env.TIBBER_TOKEN
const TIME_ZONE = { timezone: 'Europe/Stockholm' }

let data, today, current, mean

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

const getCurrent = () => { 

  /*
  {
    total: 2.8531,
    energy: 2.2412,
    tax: 0.6119,
    startsAt: '2022-08-23T00:00:00.000+02:00'
  },

  */
  //const currentTime = new Date().toLocaleTimeString('sv', {timezone: 'Europe/Stockholm'})
  const currentHour = new Date().toLocaleTimeString('sv-SE', TIME_ZONE).slice(0,2)
  console.log('CURRENT HOUR:', currentHour)
  const currentPriceElement = today.find(priceAt => {
    const time = priceAt.startsAt;
    const hour = time.slice(11, 13)
    return hour === currentHour
  })
  
  console.log(currentPriceElement)
  return currentPriceElement;
}

const checkCurrentPrice =  (aboveActionCallback, belowActionCallback) => {
  const today = data.viewer.homes[0].currentSubscription.priceInfo.today
  console.log('Medel:', mean)
  console.log('Pris just nu:', current.total, current.level)
  if (current.total > mean) {
    aboveActionCallback()
  } else {
    belowActionCallback()
  }
}

const endpoint = 'https://api.tibber.com/v1-beta/gql'

const graphQLClient = new GraphQLClient(endpoint, {
  headers: {
    authorization: TOKEN,
  },
})

const fetchPricesAndInitState = async() => {
  data = await fetchPrices();
  today = data.viewer.homes[0].currentSubscription.priceInfo.today
  current = data.viewer.homes[0].currentSubscription.priceInfo.current
  mean = meanPrice(today)
}

await fetchPricesAndInitState()

/* Check if current hour price is under mean price every hour */
const checkHourPrice = schedule('1 * * * *', () => {
  current = getCurrent()
  checkCurrentPrice(() => console.log('STÄNG AV'), () => console.log('SÄTT PÅ'))
}, {
  scheduled: false,
  ...TIME_ZONE
});

/* Fetch new prices at 00:00 */
const fetchNewDayData = schedule('0 0 * * *', async() => {
  await fetchPricesAndInitState()
}, {
  scheduled: false,
  ...TIME_ZONE
});

checkCurrentPrice(() => console.log('STÄNG AV'), () => console.log('SÄTT PÅ'))

checkHourPrice.start()
fetchNewDayData.start()

http.createServer(function (req, res) {
    const currentHour = new Date().toLocaleTimeString('sv-SE', TIME_ZONE).slice(0,2)
    console.log(`Just got a request at ${req.url}!`, currentHour)
    res.write(current.total + ' ' + current.level);
    res.end();
}).listen(process.env.PORT || 3000);

console.log('Time to save some money')