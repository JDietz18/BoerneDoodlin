import test from 'node:test';
import assert from 'node:assert/strict';
import { SnackGame } from '../dist/engine.js';
import { CHARACTERS } from '../dist/characters.js';

test('runner supports short supply-run goals and character hearts', () => {
  const events=[];
  const game=new SnackGame({onEvent:event=>events.push(event.type)});
  game.setCharacter(CHARACTERS.spike.stats);
  game.reset({goal:320,difficulty:1.2});
  game.invincible=999;
  assert.equal(game.goal,320);
  assert.equal(game.hearts,4);
  for(let i=0;i<2000&&game.mode==='running';i++) game.update(.0334);
  assert.equal(game.mode,'won');
  assert.ok(game.score>=400);
});

test('ending is idempotent', () => {
  const events=[];
  const game=new SnackGame({onEvent:event=>events.push(event.type)});
  game.reset();
  game.end(true);
  game.end(true);
  assert.deepEqual(events.filter(type=>type==='won'),['won']);
});

test('pausing on a zone transition stops same-tick runner processing', () => {
  const game=new SnackGame({onEvent:event=>{if(event.type==='zone')game.pause();}});
  game.reset({goal:180});
  game.distance=59.99;
  game.update(.0334);
  assert.equal(game.mode,'paused');
  assert.equal(game.entities.length,0);
});

test('Kevin earns zoomies sooner than Griffin from the same supply pickups', () => {
  const runners=['griffin','kevin'].map(id=>{
    const game=new SnackGame();
    game.setCharacter(CHARACTERS[id].stats);
    game.reset();
    for(let i=0;i<6;i++){
      game.entities.push({type:'bone',x:game.player.x,y:game.ground-60,w:54,h:54,taken:false});
      game.update(.016);
    }
    return game;
  });
  assert.equal(runners[0].zoom(),false);
  assert.equal(runners[1].zoom(),true);
  assert.ok(runners[1].zoomTime>0);
});
