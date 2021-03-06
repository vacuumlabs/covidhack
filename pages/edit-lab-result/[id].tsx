import {Button, Paper, TextField} from '@material-ui/core'
import LoadingIcon from '@material-ui/core/CircularProgress'
import DeleteIcon from '@material-ui/icons/Delete'
import PictureAsPdfIcon from '@material-ui/icons/PictureAsPdf'
import Alert from '@material-ui/lab/Alert'
import download from 'downloadjs'
import produce from 'immer'
import {GetServerSideProps} from 'next'
import Router from 'next/router'
import React, {useCallback, useState} from 'react'
import ReactDataSheet from 'react-datasheet'
import {FaFileCsv} from 'react-icons/fa'
import ConfirmationDialog from '../../components/ConfirmationDialog'
import CellLegend, {LAB_TABLE_BACKGROUNDS} from '../../components/lab/CellLegend'
import Layout from '../../components/Layout'
import {createBioradCsv, createBrandCsv} from '../../logic/lab'
import {ensureAuthentication} from '../../utils/auth'
import {client} from '../../utils/gql'
import {GridWithLabResultsQueryQuery} from '../../utils/graphqlSdk'
import {
  addFrame,
  isValidSampleCodeCell,
  mapLabResultsToGrid,
  removeFrame,
} from '../../utils/helpers'
import {createPdf, getGridContent, printLabDoc} from '../../utils/pdf/pdf'

export interface GridElement extends ReactDataSheet.Cell<GridElement, string> {
  value: string | null
  positive?: boolean
  needsRetest: boolean
  readOnly: boolean
}

class MyReactDataSheet extends ReactDataSheet<GridElement, string> {}

type Props = {
  grid: GridWithLabResultsQueryQuery
}

const EditLabResult = ({grid}: Props) => {
  const [isSavingCells, setIsSavingCells] = useState(false)
  const [localTitle, setLocalTitle] = useState(grid.grid_by_pk.title)
  const [showRemoveDialog, setShowRemoveDialog] = useState(false)
  const [showEditTableConfirmationDialog, setShowEditTableConfirmationDialog] = useState(false)
  // TODO: we are lying TS here, it's not a grid element because of header
  const [labResultDataTable, setLabResultDataTable] = useState<GridElement[][]>(
    addFrame(mapLabResultsToGrid(grid.lab_result)) as any,
  )

  const updateLabResult = useCallback(
    (updateProps) =>
      fetch('/api/update-lab-result', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateProps),
      }).then((r) => r.json()),
    [],
  )

  const updateGrid = useCallback(
    (updateProps) =>
      fetch('/api/update-grid', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateProps),
      }).then((r) => r.json()),
    [],
  )

  const valueViewer: ReactDataSheet.ValueViewer<GridElement, string> = useCallback((props) => {
    const isFrame = props.row === 0 || props.col === 0
    const specialCellBackgroundStyle = props.cell.cellStatus
      ? {backgroundColor: LAB_TABLE_BACKGROUNDS[props.cell.cellStatus]}
      : {}

    const frameStyle = isFrame ? {background: 'whitesmoke', color: '#999'} : {}
    return (
      <div style={{...specialCellBackgroundStyle, ...frameStyle}}>
        {props.cell.value}
        {/* a super hacky fix - the div (with color) did not render when value was empty,  add text with opacity 0 to force it */}
        {/* TODO correct way to do this is with cellRenderer, but having that always breaks drag-selection */}
        <span style={{opacity: 0}}>.</span>
      </div>
    )
  }, [])

  const cellRenderer: ReactDataSheet.CellRenderer<GridElement, string> = useCallback(
    (props) => {
      // dont edit finished and dont add on frame
      const isFrame = props.row === 0 || props.col === 0

      let backgroundStyle = {}
      if (props.cell.positive) backgroundStyle = {backgroundColor: 'red'}
      if (props.cell.needsRetest) backgroundStyle = {backgroundColor: 'orange'}

      const cursorStyle = isValidSampleCodeCell(props.cell)
        ? {cursor: 'pointer'}
        : {cursor: 'not-allowed'}
      const frameStyle = isFrame ? {background: 'whitesmoke', color: '#999'} : {}
      return (
        <td
          style={{...backgroundStyle, ...cursorStyle, ...frameStyle, width: 200}}
          onMouseDown={(e) => {
            // right click
            if (e.button === 2) {
              setLabResultDataTable(
                produce(labResultDataTable, (data: any) => {
                  if (isValidSampleCodeCell(props.cell)) {
                    data[props.row][props.col].needsRetest = !props.cell.needsRetest
                    data[props.row][props.col].positive = false
                  }
                }),
              )
            } else {
              setLabResultDataTable(
                produce(labResultDataTable, (data: any) => {
                  if (isValidSampleCodeCell(props.cell)) {
                    data[props.row][props.col].positive = !props.cell.positive
                    data[props.row][props.col].needsRetest = false
                  }
                }),
              )
            }
          }}
          onMouseOver={props.onMouseOver}
          className={`cell ${props.isFrame ? 'frame' : ''}`}
          onContextMenu={(e) => e.preventDefault()}
        >
          {props.children}
        </td>
      )
    },
    [labResultDataTable],
  )

  const anyCellChange = () => {
    const initial = mapLabResultsToGrid(grid.lab_result)
    let changed = false
    removeFrame(labResultDataTable).forEach((row, r) =>
      row.forEach((cell: any, c) => {
        if (
          cell.positive !== initial[r][c].positive ||
          cell.needsRetest !== initial[r][c].needsRetest
        ) {
          changed = true
        }
      }),
    )
    return changed
  }
  const containsChanges = localTitle !== grid.grid_by_pk.title || anyCellChange()

  if (!grid) return <div />
  return (
    <>
      <Layout isFormPage headerTitle="Upraviť laboratórny test">
        <ConfirmationDialog
          open={showRemoveDialog}
          setOpen={setShowRemoveDialog}
          onConfirm={async () => {
            // TODO: do something with the response (check error)
            await fetch('/api/remove-grid', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({id: grid.grid_by_pk.id}),
            })
            setShowRemoveDialog(false)
            Router.push('/')
          }}
          onCancel={() => setShowRemoveDialog(false)}
          title="Vymazať test?"
          description="Naozaj si prajete test vymazať spolu so všetkými jeho vzorkami?"
        />

        <ConfirmationDialog
          open={showEditTableConfirmationDialog}
          setOpen={setShowEditTableConfirmationDialog}
          onConfirm={() => {
            Router.push(`/edit-lab-result-samples/${grid.grid_by_pk.id}`)
          }}
          onCancel={() => setShowEditTableConfirmationDialog(false)}
          title="Upraviť políčka tabuľky?"
          description="Naozaj si prajete prejsť na stránku pre zmenu políčok v tabuľke? Prídete tým o práve vykonané zmeny."
        />

        <Paper
          style={{
            minHeight: 'calc(100vh - 75px - 120px)',
            display: 'flex',
            flexDirection: 'column',
            margin: 16,
            padding: 16,
          }}
        >
          <Alert severity="info" style={{marginBottom: 8}}>
            Pozitívne vzorky označte ľavým kliknutím na políčka s číslom vzorky v tabuľke (červené
            pozadie). Pravím klikom označíte vzorky, ktore majú byť znovu otestované (oranžové
            pozadie).
          </Alert>
          <TextField
            autoFocus
            value={localTitle}
            placeholder="Title"
            variant="outlined"
            onChange={(e) => {
              setLocalTitle(e.target.value)
            }}
            style={{marginBottom: 8}}
          />

          <MyReactDataSheet
            data={labResultDataTable}
            valueRenderer={(cell) => cell.value}
            valueViewer={valueViewer}
            cellRenderer={cellRenderer}
          />
          <CellLegend />
          <div className="button-panel">
            <Button
              variant="contained"
              onClick={() => {
                if (!containsChanges) {
                  Router.push(`/edit-lab-result-samples/${grid.grid_by_pk.id}`)
                } else {
                  setShowEditTableConfirmationDialog(true)
                }
              }}
            >
              Opraviť vzorky
            </Button>

            <Button
              style={{marginLeft: 8}}
              variant="contained"
              onClick={() =>
                download(createBioradCsv(labResultDataTable), `biorad-${localTitle}.csv`)
              }
              disabled={!grid.grid_by_pk.finished}
              startIcon={<FaFileCsv />}
            >
              Biorad
            </Button>
            <Button
              style={{marginLeft: 8}}
              variant="contained"
              onClick={() =>
                download(createBrandCsv(labResultDataTable), `brand-${localTitle}.csv`)
              }
              disabled={!grid.grid_by_pk.finished}
              startIcon={<FaFileCsv />}
            >
              Brand
            </Button>
            <Button
              style={{marginLeft: 8}}
              variant="contained"
              onClick={() =>
                createPdf(
                  `mriezka-${localTitle}`,
                  getGridContent(`Mriežka ${localTitle}`, mapLabResultsToGrid(grid.lab_result)),
                )
              }
              startIcon={<PictureAsPdfIcon />}
            >
              Mriežka
            </Button>
            <Button
              style={{marginLeft: 8}}
              variant="contained"
              onClick={() => printLabDoc(grid.grid_by_pk)}
              disabled={!grid.grid_by_pk.finished}
              startIcon={<PictureAsPdfIcon />}
            >
              Protokol
            </Button>
            <Button
              style={{marginLeft: 8}}
              variant="contained"
              color="secondary"
              onClick={() => {
                setShowRemoveDialog(true)
              }}
              startIcon={<DeleteIcon style={{color: 'white'}} />}
            >
              Vymazať
            </Button>
            <Button
              style={{marginLeft: 8}}
              variant="contained"
              color="primary"
              onClick={async () => {
                setIsSavingCells(true)
                await updateGrid({id: grid.grid_by_pk.id, title: localTitle, finished: true})

                const initial = mapLabResultsToGrid(grid.lab_result)
                const promises = []
                removeFrame(labResultDataTable).forEach((row, r) =>
                  row.forEach((cell: GridElement, c) => {
                    if (
                      cell.positive !== initial[r][c].positive ||
                      cell.needsRetest !== initial[r][c].needsRetest
                    ) {
                      promises.push(
                        updateLabResult({
                          gridId: grid.grid_by_pk.id,
                          column: c,
                          row: r,
                          positive: cell.positive,
                          needsRetest: cell.needsRetest,
                        }),
                      )
                    }
                  }),
                )
                await Promise.all(promises)
                Router.push('/')
              }}
              // do not disable when there are no changes there will be no user action (apart from
              // cliciking this button) if all samples are negative
              disabled={isSavingCells}
              startIcon={isSavingCells && <LoadingIcon style={{color: 'white'}} size={20} />}
            >
              Vyhodnotiť
            </Button>
          </div>
        </Paper>
      </Layout>
      <style jsx>{`
        .button-panel {
          margin: 8px 0;
          align-self: flex-end;
        }

        .wrapper {
          display: flex;
          align-items: center;
          flex-direction: column;
          justify-content: center;
        }
        .img {
          width: 100%;
          max-width: 200px;
          height: 187px;
        }
      `}</style>
      {/* had to copy manually from react-datasheet package as importing in _app.tsx did not work */}
      <style jsx global>{`
        span.data-grid-container,
        span.data-grid-container:focus {
          outline: none;
        }

        .data-grid-container .data-grid {
          table-layout: fixed;
          border-collapse: collapse;
        }

        .data-grid-container .data-grid .cell.updated {
          background-color: rgba(0, 145, 253, 0.16);
          transition: background-color 0ms ease;
        }
        .data-grid-container .data-grid .cell {
          height: 17px;
          user-select: none;
          -moz-user-select: none;
          -webkit-user-select: none;
          -ms-user-select: none;
          cursor: cell;
          background-color: unset;
          transition: background-color 500ms ease;
          vertical-align: middle;
          text-align: right;
          border: 1px solid #ddd;
          padding: 0;
        }
        .data-grid-container .data-grid .cell.selected {
          border: 1px double rgb(33, 133, 208);
          transition: none;
          box-shadow: inset 0 -100px 0 rgba(33, 133, 208, 0.15);
        }

        .data-grid-container .data-grid .cell.read-only {
          background: whitesmoke;
          color: #999;
          text-align: center;
        }

        .data-grid-container .data-grid .cell > .text {
          padding: 2px 5px;
          text-overflow: ellipsis;
          overflow: hidden;
        }

        .data-grid-container .data-grid .cell > input {
          outline: none !important;
          border: 2px solid rgb(33, 133, 208);
          text-align: right;
          width: calc(100% - 6px);
          height: 11px;
          background: none;
          display: block;
        }

        .data-grid-container .data-grid .cell {
          vertical-align: bottom;
        }

        .data-grid-container .data-grid .cell,
        .data-grid-container .data-grid.wrap .cell,
        .data-grid-container .data-grid.wrap .cell.wrap,
        .data-grid-container .data-grid .cell.wrap,
        .data-grid-container .data-grid.nowrap .cell.wrap,
        .data-grid-container .data-grid.clip .cell.wrap {
          white-space: normal;
          padding: 4px;
          text-align: center;
        }

        .data-grid-container .data-grid.nowrap .cell,
        .data-grid-container .data-grid.nowrap .cell.nowrap,
        .data-grid-container .data-grid .cell.nowrap,
        .data-grid-container .data-grid.wrap .cell.nowrap,
        .data-grid-container .data-grid.clip .cell.nowrap {
          white-space: nowrap;
          overflow-x: visible;
        }

        .data-grid-container .data-grid.clip .cell,
        .data-grid-container .data-grid.clip .cell.clip,
        .data-grid-container .data-grid .cell.clip,
        .data-grid-container .data-grid.wrap .cell.clip,
        .data-grid-container .data-grid.nowrap .cell.clip {
          white-space: nowrap;
          overflow-x: hidden;
        }

        .data-grid-container .data-grid .cell .value-viewer,
        .data-grid-container .data-grid .cell .data-editor {
          display: block;
          font-size: 16px;
          border: 0;
          padding: 0;
          height: auto;
        }
      `}</style>
    </>
  )
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  if (!ensureAuthentication(context.req, context.res)) return {props: {}} as any

  const grid = await client.GridWithLabResultsQuery({
    id: context.params.id,
  })

  return {
    props: {
      grid,
    },
  }
}

export default EditLabResult
