// server.js

const express = require('express');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());

const API_KEY = process.env.NEXON_API_KEY;

// 딜레이 설정
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const checkDelay = 20; // 요청 간 딜레이 (밀리초)

// Axios 인스턴스
const axiosInstance = axios.create({
  baseURL: 'https://open.api.nexon.com/maplestory/v1',
  headers: {
    'accept': 'application/json',
    'x-nxopen-api-key': API_KEY
  }
});

// 길드 멤버 정보를 가져오는 api
app.post('/api/guild/members', async (req, res) => {
  const { guild, world } = req.body;

  if (!guild || !world) {
    return res.status(400).json({ error: 'Guild and world are required' });
  }

  try {
    const guildId = await fetchGuildId(guild, world);
    if (!guildId) {
      return res.status(404).json({ error: 'Guild not found' });
    }

    const guildData = await fetchGuildInfo(guildId);
    if (!guildData) {
      return res.status(404).json({ error: 'Guild info not found' });
    }

    const memberStatus = await fetchAndCheckMainCharacters(guildData.guild_member, world);

    return res.json({ memberStatus });

  } catch (error) {
    console.error('Error processing guild members:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 길드 ID를 가져오는 함수
const fetchGuildId = async (guild, world) => {
  const params = {
    guild_name: guild,
    world_name: world
  };

  try {
    const response = await axiosInstance.get('/guild/id', { params });
    return response.data.oguild_id;

  } catch (error) {
    console.error('Error fetching guild ID:', error);
    return null;
  }
};

// 길드 정보를 가져오는 함수
const fetchGuildInfo = async (guildId) => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const date = yesterday.toISOString().split('T')[0];

  const params = {
    oguild_id: guildId,
    date: date
  };

  try {
    const response = await axiosInstance.get('/guild/basic', { params });
    return response.data;

  } catch (error) {
    console.error('Error fetching guild info:', error);
    return null;
  }
};

// 캐릭터 ID를 가져오는 함수
const fetchCharacterId = async (characterName) => {
  const params = {
    character_name: characterName
  };

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await axiosInstance.get('/id', { params });
      return response.data.ocid;

    } catch (error) {
      if (error.response && error.response.status === 429) {
        console.warn(`429 Too Many Requests for ${characterName}. Retrying...`);
        await delay(3000); // 3초 대기 후 재시도
        continue;
      }
      console.error('Error fetching character ID:', error);
      return null;
    }
  }

  return null;
};

// 본캐 여부를 확인하는 함수
const checkIfMainCharacter = async (characterName, characterId, worldName) => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const date = yesterday.toISOString().split('T')[0];

  const params = {
    date: date,
    world_name: worldName,
    ocid: characterId
  };

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await axiosInstance.get('/ranking/union', { params });
      const data = response.data;

      if (data.ranking && data.ranking.length > 0) {
        const isMainCharacter = data.ranking[0].character_name === characterName;
        return { isMainCharacter, mainCharacterName: data.ranking[0].character_name };
      } else {
        return { isMainCharacter: false, mainCharacterName: null };
      }

    } catch (error) {
      if (error.response && error.response.status === 429) {
        console.warn(`429 Too Many Requests for ${characterName}. Retrying...`);
        await delay(3000);
        continue;
      }
      console.error('Error checking main character status:', error);
      return { isMainCharacter: false, mainCharacterName: null };
    }
  }

  return { isMainCharacter: false, mainCharacterName: null };
};

// 캐릭터 정보 가져오는 함수
const fetchCharacterDetails = async (characterId) => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const date = yesterday.toISOString().split('T')[0];

  const params = {
    ocid: characterId,
    date: date
  };

  try {
    const response = await axiosInstance.get('/character/basic', { params });
    return response.data;

  } catch (error) {
    console.error('Error fetching character details:', error);
    return null;
  }
};

// 길드 멤버들의 정보를 가져오고 본캐 여부를 확인하는 함수
const fetchAndCheckMainCharacters = async (guildMembers, world) => {
  const results = [];

  for (let i = 0; i < guildMembers.length; i++) {
    const member = guildMembers[i];
    const characterId = await fetchCharacterId(member);

    if (characterId) {
      const { isMainCharacter, mainCharacterName } = await checkIfMainCharacter(member, characterId, world);
      const isMainCharacterInGuild = guildMembers.includes(mainCharacterName);
      const characterDetails = await fetchCharacterDetails(characterId);

      results.push({
        member,
        isMainCharacter,
        mainCharacterName,
        isMainCharacterInGuild,
        characterLevel: parseInt(characterDetails?.character_level, 10) || 0,
        characterClass: characterDetails?.character_class || "N/A",
        characterGuild: characterDetails?.character_guild_name || "N/A",
        characterAccess: characterDetails?.access_flag || false,
        characterImage: characterDetails?.character_image || null,
      });
    } else {
      results.push({
        member,
        isMainCharacter: false,
        mainCharacterName: null,
        isMainCharacterInGuild: false,
        characterLevel: 'N/A',
        characterClass: "N/A",
        characterGuild: "N/A",
        characterAccess: false,
        characterImage: null,
      });
    }

    // 요청 간 딜레이 적용
    await delay(checkDelay);
  }

  return results;
};

// 리액트 빌드 파일 제공 설정
const buildPath = path.join(__dirname, '..', 'build');
app.use(express.static(buildPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(buildPath, 'index.html'));
});

// 서버 시작
const PORT = process.env.PORT || 3141;
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
