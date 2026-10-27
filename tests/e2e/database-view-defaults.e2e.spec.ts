import {test,expect} from 'playwright/test';
import {createWorkspaceFixture,jsonFetch} from './support/slacord-api';
import {loginWithSession} from './support/slacord-session';
import type {DatabaseContainer,DatabaseDetail} from '../../packages/web/src/features/database/model/types';

test('blank databases prepare board and calendar properties and retain the original table',async({page})=>{
  const f=await createWorkspaceFixture();
  const call=async<T>(path:string,body?:unknown)=>(await jsonFetch<T>(`/team/${f.teamId}${path}`,{token:f.owner.token,body,method:body?'POST':'GET'}))!.data!;
  const container=await call<DatabaseContainer>('/database-container',{name:'Team work',blank:true});
  const api=`/database/${container.sources[0].id}`;
  expect((await call<DatabaseDetail>(api)).properties).toHaveLength(0);
  await loginWithSession(page,f.owner);await page.goto(`/${f.teamId}/docs?database=${container.id}`);
  for(const [layout,name] of [['board','업무 보드'],['calendar','업무 달력']]){
    await page.getByRole('button',{name:'+ 보기 추가',exact:true}).click();
    await page.getByLabel('새 보기 레이아웃',{exact:true}).selectOption(layout);
    await page.getByLabel('보기 이름',{exact:true}).fill(name);
    await page.getByRole('button',{name:'보기 저장',exact:true}).click();
    await expect.poll(async()=>(await call<DatabaseDetail>(api)).views.some(view=>view.name===name)).toBe(true);
    await expect(page.getByRole('button',{name:'표',exact:true})).toBeVisible();
    const detail=await call<DatabaseDetail>(api);
    const view=detail.views.find(view=>view.name===name)!;
    const property=detail.properties.find(prop=>prop.id===(layout==='board'?view.groupProperty:view.dateProperty));
    expect(property?.type).toBe(layout==='board'?'status':'date');
    await expect(page).toHaveURL(new RegExp(`view=${view.id}`));
    await page.reload();
    await expect(page.getByRole('button',{name,exact:true})).toBeVisible();
  }
  const detail=await call<DatabaseDetail>(api);
  expect(detail.views).toHaveLength(3);
  expect(detail.properties).toHaveLength(2);
});
