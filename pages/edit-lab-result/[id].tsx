import {GetServerSideProps} from 'next'
import {useRouter} from 'next/router'
import React, {useCallback, useMemo} from 'react'
import ReactDataSheet from 'react-datasheet'
import useSWR from 'swr'
import Layout from '../../components/Layout'
import {allowAccessFor} from '../../utils/auth'
import {GridWithLabResultsQueryQuery} from '../../utils/graphqlSdk'
import {mapLabResultsToGrid} from '../../utils/helpers'

export interface GridElement extends ReactDataSheet.Cell<GridElement, string> {
  value: string | null
  positive: boolean
  readOnly: boolean
}

class MyReactDataSheet extends ReactDataSheet<GridElement, string> {}

const fetcher = (url) => fetch(url).then((r) => r.json())

const SuccessRegistration = () => {
  const router = useRouter()
  const {id} = router.query
  const {data, error, mutate} = useSWR(`/api/grid/${id}`, fetcher)
  const typedData = data as GridWithLabResultsQueryQuery
  const mappedLabResultData = useMemo(() => {
    if (!data) return null
    return mapLabResultsToGrid(typedData.lab_result)
  }, [typedData, error])
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
  const valueViewer: ReactDataSheet.ValueViewer<GridElement, string> = useCallback(
    (props) => {
      const backgroundStyle = props.cell.positive ? {backgroundColor: 'red'} : {}
      return (
        <div style={backgroundStyle}>
          {props.cell.value}
          <input
            type="checkbox"
            checked={props.cell.positive}
            onChange={() => {
              mutate(
                updateLabResult({
                  gridId: id,
                  column: props.col,
                  row: props.row,
                  positive: !props.cell.positive,
                }),
              )
            }}
          />
        </div>
      )
    },
    [id, mutate, updateLabResult],
  )

  if (!data) return <div>loading</div>
  return (
    <>
      <Layout isFormPage>
        <div className="container">
          <div className="wrapper">
            <MyReactDataSheet
              data={mappedLabResultData}
              valueRenderer={(cell) => cell.value}
              valueViewer={valueViewer}
            />
          </div>
        </div>
      </Layout>
      <style jsx>{`
        .container {
          min-height: calc(100vh - 75px - 120px);
          display: flex;
          justify-content: center;
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
        }
      `}</style>
    </>
  )
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  if (!allowAccessFor(context.req.headers.authorization, ['kancelaria', 'laboratorium'])) {
    context.res.statusCode = 401
    context.res.setHeader('WWW-Authenticate', 'Basic')
    context.res.end('Unauthorized')
    return
  }

  // const grid = await client.GridQuery({
  //   id: context.params.id,
  // })

  return {
    props: {
      // grid,
    },
  }
}

export default SuccessRegistration
