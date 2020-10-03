import * as fs from 'fs';
import * as path from 'path'
const BASEDIR = '/tmp/'

const saveProfile = (labeledFD:any) => {
    let profilesStr = ""
    try {
        profilesStr = fs.readFileSync(`${BASEDIR}/profile.json`, { encoding: "utf-8" })
        //console.log('saving profile in ' + profilesStr)
        if (profilesStr.length > 0) {
            const profile = JSON.parse(profilesStr)
            if (profile && profile.hasOwnProperty('profileList')) {
                profile.profileList.push(labeledFD)
                console.log('#####################saving final profiles' + JSON.stringify(profile))
                fs.writeFileSync(`${BASEDIR}/profile.json`, JSON.stringify(profile), {encoding: "utf-8" })
            }

        }
    }catch(e) {
        console.log(e)
    }
    
}

const loadProfile = ()  => {
    let profilesStr = ""
    try {
        profilesStr = fs.readFileSync(path.resolve(`${BASEDIR}/profile.json`)).toString()//, { encoding: "utf-8" })
        //console.log('loaded profiles: ' + profilesStr)
        if (profilesStr.length > 0) {
            const profile = JSON.parse(profilesStr)
            return profile && profile.hasOwnProperty('profileList') ? profile.profileList : []
        }
    }catch(e) {
        console.log(e)
    }
    
    return []
}

const loadEmployees = ()  => {
    let employeesStr = ""
    try {
        employeesStr = fs.readFileSync(path.resolve(`${BASEDIR}/employee.json`)).toString()//, { encoding: "utf-8" })
        console.log('loaded emloyees: ' + employeesStr)
        if (employeesStr.length > 0) {
            const emloyees = JSON.parse(employeesStr)
            return emloyees && emloyees.hasOwnProperty('employeeList') ? emloyees.employeeList : []
        }
    }catch(e) {
        console.log(e)
    }
    
    return []
}

const saveEmployees = (jsonData:any) => {
    fs.writeFileSync(`${BASEDIR}/employee.json`, JSON.stringify(jsonData), {encoding: "utf-8" })
}

export { saveProfile, loadProfile, loadEmployees, saveEmployees }