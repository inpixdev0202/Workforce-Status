import axios from 'axios';

async function testFrontendLogic() {
    const resGroups = await axios.get('http://localhost:5000/api/groups');
    const resEmp = await axios.get('http://localhost:5000/api/employees');
    const resProj = await axios.get('http://localhost:5000/api/projects/all');

    const cdgGroup = resGroups.data.find(g => g.name === 'CDG');
    const groupProjects = resProj.data.filter(p => p.group_id === cdgGroup.id);
    const groupEmployees = resEmp.data.filter(e => e.group_id === cdgGroup.id);

    console.log(`Frontend sees ${groupEmployees.length} employees for CDG.`);
    const regulars = groupEmployees.filter(e => e.employment_type === '정규직');
    console.log(`Frontend sees ${regulars.length} regular employees for CDG.`);

    // How many in empTotals?
    const allAssignments = [];
    groupProjects.forEach(p => p.assignments.forEach(a => allAssignments.push(a)));

    const empTotals = {};
    allAssignments.forEach(a => {
        empTotals[a.employee_id] = true;
    });

    let assignedRegulars = 0;
    regulars.forEach(r => {
        if (empTotals[r.id]) assignedRegulars++;
    });

    console.log(`Frontend empTotals has ${assignedRegulars} regulars.`);
}

testFrontendLogic();
