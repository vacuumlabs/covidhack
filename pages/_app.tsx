import DateFnsUtils from '@date-io/date-fns' // choose your lib
import CssBaseline from '@material-ui/core/CssBaseline'
import {MuiPickersUtilsProvider} from '@material-ui/pickers'
import {AppProps} from 'next/app'
import React from 'react'
import {Provider as ReduxProvider} from 'react-redux'
import {configureStore} from '../logic/redux/configureStore'

const store = configureStore()

function App({Component, pageProps}: AppProps) {
  // redirect to https when running non-dev in browser
  if (!(process.env.NODE_ENV === 'development') && process.browser) {
    const httpTokens = /^http:\/\/(.*)$/.exec(window.location.href)
    if (httpTokens) {
      window.location.replace('https://' + httpTokens[1])
    }
  }
  return (
    <MuiPickersUtilsProvider utils={DateFnsUtils}>
      <CssBaseline />
      <ReduxProvider store={store}>
        <Component {...pageProps} />
      </ReduxProvider>
    </MuiPickersUtilsProvider>
  )
}

export default App
