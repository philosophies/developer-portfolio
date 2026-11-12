import {readFile} from 'node:fs/promises';
const report=JSON.parse(await readFile(process.argv[2],'utf8'));
if(!Array.isArray(report.projects) || !report.projects.length)throw new Error('No project audit evidence returned');
if(report.logs?.some(x=>x.level==='error'))throw new Error('NuGet advisory query failed');
const affected=[];
for(const project of report.projects??[])for(const framework of project.frameworks??[])for(const pkg of [...(framework.topLevelPackages??[]),...(framework.transitivePackages??[])])if(pkg.vulnerabilities?.length)affected.push(pkg.id);
if(affected.length)throw new Error('Review vulnerable NuGet packages: '+affected.join(', '));
console.log('No vulnerable NuGet packages reported');
