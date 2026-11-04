import type{ApexOptions,ApexAxisChartSeries}from'apexcharts';
export type DailyMetrics={day:string;visits:number;pageViews:number;enquiries:number;whatsapp:number;phone:number;email:number};
type Report={daily:DailyMetrics[];tours:{title:string;views:number;clicks:number;saves:number}[];devices:{name:string;count:number}[];sources:{name:string;count:number}[];journey:[string,number][]};
const colors=['#1b616b','#e2b02e','#6a9567','#c1754c'];
function base(type:'area'|'bar'|'donut'):ApexOptions{return {chart:{type,fontFamily:'Montserrat, sans-serif',foreColor:'#63736e',toolbar:{show:false},zoom:{enabled:false},parentHeightOffset:0,background:'transparent'},colors,stroke:{curve:'smooth',width:3},dataLabels:{enabled:false},grid:{borderColor:'#e9ede7',strokeDashArray:4},legend:{position:'bottom',fontSize:'11px'},tooltip:{theme:'light'},noData:{text:'No activity in this period'},yaxis:{min:0,forceNiceScale:true,decimalsInFloat:0},responsive:[{breakpoint:600,options:{legend:{fontSize:'10px'},yaxis:{labels:{maxWidth:120}},xaxis:{labels:{style:{fontSize:'9px'}}}}}]};}
function bars(names:string[],series:ApexAxisChartSeries):ApexOptions{return {...base('bar'),series,plotOptions:{bar:{horizontal:true,borderRadius:4,barHeight:'55%'}},stroke:{width:0},xaxis:{categories:names,labels:{formatter:(value:string)=>String(Math.round(Number(value)))}},yaxis:{labels:{maxWidth:210,style:{fontSize:'11px'}}}};}
export function analyticsCharts(data:Report){
 const dates=data.daily.map(d=>d.day);
 return {
 traffic:{...base('area'),series:[{name:'Visits',data:data.daily.map(d=>d.visits)},{name:'Page views',data:data.daily.map(d=>d.pageViews)}],markers:{size:data.daily.length===1?5:0},fill:{type:'gradient',gradient:{opacityFrom:.2,opacityTo:.02}},xaxis:{categories:dates,labels:{rotate:0,hideOverlappingLabels:true}},tooltip:{shared:true,intersect:false}} as ApexOptions,
 tours:bars(data.tours.map(t=>t.title),[{name:'Views',data:data.tours.map(t=>t.views)},{name:'Clicks',data:data.tours.map(t=>t.clicks)},{name:'Saves',data:data.tours.map(t=>t.saves)}]),
 contacts:{...base('bar'),chart:{...base('bar').chart,stacked:true},series:[{name:'Enquiries',data:data.daily.map(d=>d.enquiries)},{name:'WhatsApp',data:data.daily.map(d=>d.whatsapp)},{name:'Phone',data:data.daily.map(d=>d.phone)},{name:'Email',data:data.daily.map(d=>d.email)}],stroke:{width:0},plotOptions:{bar:{borderRadius:3,columnWidth:'45%'}},xaxis:{categories:dates},tooltip:{shared:true,intersect:false}} as ApexOptions,
 devices:{...base('donut'),series:data.devices.some(d=>d.count>0)?data.devices.map(d=>d.count):[],labels:data.devices.map(d=>d.name),stroke:{width:4,colors:['#fff']},plotOptions:{pie:{donut:{size:'72%'}}},tooltip:{y:{formatter:(value:number)=>`${value} visits`}}} as ApexOptions,
 sources:bars(data.sources.map(s=>s.name),[{name:'Visits',data:data.sources.map(s=>s.count)}]),
 journey:bars(data.journey.map(([label])=>label),[{name:'Visits',data:data.journey.map(([,count])=>count)}])
 };
}
