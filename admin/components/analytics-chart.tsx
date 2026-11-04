import React,{useEffect,useRef,useState}from'react';
import type ApexCharts from'apexcharts';import type{ApexOptions}from'apexcharts';
import{Loader}from'./feedback';
export function AnalyticsChart({options,label,height=300}:{options:ApexOptions;label:string;height?:number}){
 const target=useRef<HTMLDivElement>(null);const[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{let active=true;let chart:ApexCharts|undefined;setLoading(true);setError('');
 import('apexcharts').then(async({default:ApexCharts})=>{if(!active||!target.current)return;chart=new ApexCharts(target.current,{...options,chart:{...options.chart,height,animations:{enabled:!window.matchMedia('(prefers-reduced-motion: reduce)').matches}}});await chart.render();}).catch(()=>{if(active)setError('Chart unavailable. Use the figures below or export CSV.');}).finally(()=>{if(active)setLoading(false);});
 return()=>{active=false;chart?.destroy();};},[options,height]);
 return <div className="hct-apex-chart" style={{minHeight:height}}><div ref={target} role="img" aria-label={label}/>{loading&&<div className="chart-loading"><Loader label="Loading chart…"/></div>}{error&&<p role="status" className="text-sm text-muted-foreground p-4">{error}</p>}</div>;
}
