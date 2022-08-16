const convertSnakeToCamel = require('../lib/convertSnakeToCamel');

const saveUserPreference = async (conn, params) => {
  // 해당 유저가 존재하는지 확인
  const [user] = await conn.query('SELECT * FROM `user` WHERE id = (?)', [params.id]);

  // 유저가 존재하지 않는 경우
  if (!user[0]) return 0;

  await conn.query(
    'INSERT INTO `user_preference` (user_id, age, job, excepted_univ, included_univ, game_percent, sweet_percent, fun_percent, appearance, mbti, fashion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);',
    [
      params.id,
      params.age,
      JSON.stringify(params.job),
      JSON.stringify(params.exceptedUniv),
      JSON.stringify(params.includedUniv),
      params.gamePercent,
      params.sweetPercent,
      params.funPercent,
      JSON.stringify(params.appearance),
      JSON.stringify(params.mbti),
      JSON.stringify(params.fashion),
    ],
  );

  // 가장 마지막에 저장한 유저 선호 정보 id 가져오기 (== 마지막 auto_increment id)
  [newUserPrefernceId] = await conn.query('SELECT LAST_INSERT_ID();');
  newUserPrefernceId = newUserPrefernceId[0]['LAST_INSERT_ID()'];

  const [row] = await conn.query('SELECT * FROM `user_preference` WHERE id = (?)', [newUserPrefernceId]);

  return convertSnakeToCamel.keysToCamel(row[0]);
};

module.exports = {
  saveUserPreference,
};