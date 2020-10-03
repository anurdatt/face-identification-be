
const csvToJson = <T>(type: {(): T ;}, csvData: Buffer | string):T[] => {
    let retJson:T[] = []
    const srcCsv:string = csvData instanceof Buffer ? csvData.toString() : csvData
    const srcCsvLines = srcCsv.split('\r\n')
    console.log(JSON.stringify(srcCsvLines))
    for (const i in srcCsvLines) {
        //console.log(srcCsvLines[i])
        if(srcCsvLines[i] == null || srcCsvLines[i].trim().length == 0) continue
        const srcCsvFields:string[] = srcCsvLines[i].split(',')
        //console.log(JSON.stringify(srcCsvFields))
        let obj:T =  type()
        //console.log(JSON.stringify(obj))
        Object.keys(obj).map((key, index) => {
            obj[key] = srcCsvFields[index] ? srcCsvFields[index] : false
        })
        retJson.push(obj)
    }
    console.log(JSON.stringify(retJson))
    return retJson
}

const jsonToCsv = <T>(jsonData: T[] | string): string => {
    const srcJson = jsonData instanceof String 
    ? JSON.parse(JSON.stringify(jsonData)) : jsonData
    console.log(JSON.stringify(srcJson))
    let csvLines: string[] = []
    for (const i in srcJson) {
        const obj = srcJson[i]
        let csvLine: string[] = []
        for(const key in obj) csvLine.push(obj[key])
        csvLines.push(csvLine.join())
    }
    const retCsv:string = csvLines.join('\r\n')
    console.log(retCsv)
    return retCsv
}
export { csvToJson, jsonToCsv }