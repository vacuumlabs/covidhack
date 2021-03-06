import {Button, Dialog, DialogActions, DialogTitle, TextField} from '@material-ui/core'
import {DatePicker} from '@material-ui/pickers'
import {makeStyles} from '@material-ui/styles'
import {Form, Formik} from 'formik'
import {pick} from 'lodash'
import React from 'react'
import {useSelector} from 'react-redux'
import * as Yup from 'yup'
import {encrypt} from '../../logic/crypto'
import {State} from '../../logic/state'
import {mapValuesAsync} from '../../utils/helpers'

const useStyles = makeStyles({
  dialog: {maxWidth: '450px !important', padding: 24},
  formField: {marginBottom: '8px !important'},
})

const getInitialFormValues = (code?: string) => ({
  pacient: '',
  personalNumber: '',
  sampleCollectionDate: new Date(),
  sampleReceiveDate: new Date(),
  sampleCode: code || '',
  sender: '',
})

type Props = any

const NewApplicant = ({open, code, close}: Props) => {
  const password = useSelector((state: State) => state.officePassword)
  const classes = useStyles()

  return (
    <>
      <Dialog open={open} onClose={close} classes={{paperScrollPaper: classes.dialog}}>
        <DialogTitle style={{textAlign: 'center'}}>Nová žiadosť</DialogTitle>
        <Formik
          initialValues={getInitialFormValues(code)}
          onSubmit={async (values, {resetForm}) => {
            // TODO: maybe wait for response first
            const response = await fetch('/api/create-applicant', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                ...values,
                ...(await mapValuesAsync(
                  pick(values, ['pacient', 'personalNumber', 'sampleCode', 'sender']),
                  (val) => encrypt(val as string, password),
                )),
              }),
            })
            resetForm()
          }}
          validationSchema={Yup.object({
            pacient: Yup.string().required('Toto pole nesmie byť prázdne'),
            personalNumber: Yup.string().required('Toto pole nesmie byť prázdne'),
            sampleCode: Yup.string().required('Toto pole nesmie byť prázdne'),
            sender: Yup.string().required('Toto pole nesmie byť prázdne'),
          })}
        >
          {({values, handleChange, errors, touched, setFieldValue, handleSubmit}) => (
            <Form>
              <TextField
                autoFocus
                className={classes.formField}
                name="sampleCode"
                value={values.sampleCode}
                onChange={handleChange}
                label="Číslo vzorky"
                fullWidth
                error={touched.sampleCode && !!errors.sampleCode}
                helperText={touched.sampleCode && errors.sampleCode}
                disabled={!!code}
              />

              <TextField
                className={classes.formField}
                name="sender"
                value={values.sender}
                onChange={handleChange}
                label="Odosielateľ (meno, adresa, tel. číslo)"
                fullWidth
                error={touched.sender && !!errors.sender}
                helperText={touched.sender && errors.sender}
              />

              <TextField
                className={classes.formField}
                name="pacient"
                value={values.pacient}
                onChange={handleChange}
                label="Priezvisko a meno pacienta"
                fullWidth
                error={touched.pacient && !!errors.pacient}
                helperText={touched.pacient && errors.pacient}
              />

              <TextField
                className={classes.formField}
                name="personalNumber"
                value={values.personalNumber}
                onChange={handleChange}
                label="Rodné číslo"
                fullWidth
                error={touched.personalNumber && !!errors.personalNumber}
                helperText={touched.personalNumber && errors.personalNumber}
              />

              <DatePicker
                className={classes.formField}
                variant="inline"
                autoOk
                label="Dátum odberu vzorky"
                name="sampleCollectionDate"
                value={values.sampleCollectionDate}
                onChange={(newDate) => {
                  setFieldValue('sampleCollectionDate', newDate)
                }}
                format="d.M.yyyy"
                style={{width: '100%'}}
              />

              <DatePicker
                className={classes.formField}
                variant="inline"
                autoOk
                label="Dátum prijatia vzorky"
                name="sampleReceiveDate"
                value={values.sampleReceiveDate}
                onChange={(newDate) => {
                  setFieldValue('sampleReceiveDate', newDate)
                }}
                format="d.M.yyyy"
                style={{width: '100%'}}
              />

              <DialogActions style={{padding: '8px 0'}}>
                <Button type="submit" color="primary" variant="contained">
                  Vytvoriť ďalšiu
                </Button>
                <Button
                  onClick={async (e) => {
                    await handleSubmit(e as any)
                    close()
                  }}
                  color="primary"
                  variant="contained"
                >
                  Vytvoriť
                </Button>
                <Button onClick={close} variant="contained">
                  Zrušiť
                </Button>
              </DialogActions>
            </Form>
          )}
        </Formik>
      </Dialog>
    </>
  )
}

export default NewApplicant
