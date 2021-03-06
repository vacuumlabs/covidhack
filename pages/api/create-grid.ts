import _ from 'lodash'
import {NextApiRequest, NextApiResponse} from 'next'
import {v4} from 'uuid'
import {ValidationError} from 'yup'
import {ensureAuthentication} from '../../utils/auth'
import {client} from '../../utils/gql'
import {Lab_Result_Insert_Input} from '../../utils/graphqlSdk'
import {createGridBodySchema} from '../../utils/validations'

export default async (req: NextApiRequest, res: NextApiResponse) => {
  if (!ensureAuthentication(req, res)) return

  try {
    // need to pre-generate id so that we can reference from labResults
    const validBody = {
      ...createGridBodySchema.validateSync(req.body, {stripUnknown: true}),
      id: v4(),
    }

    const labResults: Lab_Result_Insert_Input[] = []
    validBody.grid.forEach((row, i) => {
      row.forEach((cell, j) => {
        labResults.push({
          row: i,
          column: j,
          sample_code: cell.value,
          referenced_in_grid_id: validBody.id,
          cell_status: cell.cellStatus,
        })
      })
    })

    await client.InsertGridMutation({
      gridObjects: [_.omit(validBody, 'grid')],
      labResultsObjects: labResults,
    })
    res.status(201).end()
  } catch (e) {
    if (e instanceof ValidationError) {
      console.error(e)
      // at this point, we would want to send why we failed the validation as well
      res.status(400).end()
    } else {
      console.error(e)
      res.status(500).end()
    }
  }
}
