import React, { useState, useEffect } from 'react';
import { Form, Button, Container, Row, Col, Card, ProgressBar } from 'react-bootstrap';

function SearchForm() {
  const [world, setWorld] = useState('엘리시움');
  const [guild, setGuild] = useState('메구밍');
  const [apiKey, setApiKey] = useState('');
  const [guildId, setGuildId] = useState(null);
  const [guildInfo, setGuildInfo] = useState(null);
  const [memberStatus, setMemberStatus] = useState([]);
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const checkDelay = 20;

  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const handleSearch = async (e) => {
    e.preventDefault();

    const url = `https://open.api.nexon.com/maplestory/v1/guild/id?guild_name=${encodeURIComponent(guild)}&world_name=${encodeURIComponent(world)}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'x-nxopen-api-key': apiKey
        }
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();
      setGuildId(data.oguild_id);
      console.log('Guild ID:', data.oguild_id);

      await fetchGuildInfo(data.oguild_id);

    } catch (error) {
      console.error('Error fetching guild ID:', error);
    }
  };

  const fetchGuildInfo = async (guildId) => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const date = yesterday.toISOString().split('T')[0];
    const guildInfoUrl = `https://open.api.nexon.com/maplestory/v1/guild/basic?oguild_id=${guildId}&date=${date}`;

    try {
      const response = await fetch(guildInfoUrl, {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'x-nxopen-api-key': apiKey
        }
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const guildData = await response.json();
      setGuildInfo(guildData);
      console.log('Guild Info:', guildData);

      await fetchAndCheckMainCharacters(guildData.guild_member);

    } catch (error) {
      console.error('Error fetching guild info:', error);
    }
  };

  const fetchCharacterId = async (characterName) => {
    const url = `https://open.api.nexon.com/maplestory/v1/id?character_name=${encodeURIComponent(characterName)}`;

    for (let attempt = 0; attempt < 3; attempt++) {  // 최대 3번 재시도
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'accept': 'application/json',
            'x-nxopen-api-key': apiKey
          }
        });

        if (response.status === 429) {  // 429 오류 발생 시
          console.warn(`429 Too Many Requests for ${characterName}. Retrying...`);
          await delay(3000);  // 3초 대기 후 재시도
          continue;
        }

        if (!response.ok) {
          await delay(checkDelay);
          throw new Error(`Error fetching character ID for ${characterName}: ${response.statusText}`);
        }

        const data = await response.json();
        return data.ocid;
      } catch (error) {
        console.error('Error fetching character ID:', error);
        return null;
      }
    }

    return null;  // 재시도 후에도 실패한 경우
  };

  const checkIfMainCharacter = async (characterName, characterId, worldName) => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const date = yesterday.toISOString().split('T')[0];

    const url = `https://open.api.nexon.com/maplestory/v1/ranking/union?date=${date}&world_name=${encodeURIComponent(worldName)}&ocid=${characterId}`;

    for (let attempt = 0; attempt < 3; attempt++) {  // 최대 3번 재시도
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'accept': 'application/json',
            'x-nxopen-api-key': apiKey
          }
        });

        if (response.status === 429) {  // 429 오류 발생 시
          console.warn(`429 Too Many Requests for ${characterName}. Retrying...`);
          await delay(3000);  // 3초 대기 후 재시도
          continue;
        }

        if (!response.ok) {
          await delay(checkDelay);
          throw new Error(`Error fetching ranking for ${characterName}: ${response.statusText}`);
        }

        const data = await response.json();
        if (data.ranking && data.ranking.length > 0) {
          const isMainCharacter = data.ranking[0].character_name === characterName;
          return { isMainCharacter, mainCharacterName: data.ranking[0].character_name };
        } else {
          return { isMainCharacter: false, mainCharacterName: null };
        }
      } catch (error) {
        console.error('Error checking main character status:', error);
        return { isMainCharacter: false, mainCharacterName: null };
      }
    }

    return { isMainCharacter: false, mainCharacterName: null };  // 재시도 후에도 실패한 경우
  };

  const fetchCharacterDetails = async (characterId) => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const date = yesterday.toISOString().split('T')[0];
    const url = `https://open.api.nexon.com/maplestory/v1/character/basic?ocid=${characterId}&date=${date}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'x-nxopen-api-key': apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`Error fetching character details for ID ${characterId}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching character details:', error);
      return null;
    }
  };

  const fetchAndCheckMainCharacters = async (guildMembers) => {
    setIsLoading(true);
    setProgress(0);
    const results = [];

    for (let i = 0; i < guildMembers.length; i++) {
      const member = guildMembers[i];
      const characterId = await fetchCharacterId(member);
      if (characterId) {
        const { isMainCharacter, mainCharacterName } = await checkIfMainCharacter(member, characterId);
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

      // 프로그래스바 업데이트
      setProgress(Math.round(((i + 1) / guildMembers.length) * 100));

      // 지연 추가
      await delay(checkDelay);
    }

    setMemberStatus(results);
    setIsLoading(false);
  };



  const groupByMainCharacter = (members) => {
    const grouped = members.reduce((acc, member) => {
      const key = member.mainCharacterName || member.member;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(member);
      return acc;
    }, {});

    Object.keys(grouped).forEach(key => {
      grouped[key].sort((a, b) => b.characterLevel - a.characterLevel);
    });

    const sortedGrouped = Object.entries(grouped).sort((a, b) => {
      const maxLevelA = Math.max(...a[1].map(member => member.characterLevel));
      const maxLevelB = Math.max(...b[1].map(member => member.characterLevel));

      return maxLevelB - maxLevelA; // 높은 레벨이 먼저 오도록 정렬
    });

    return sortedGrouped;
  };



  return (
    <Container className="mt-5">
      <h2 className="text-center mb-4">길드원 관리 (Pre-Alpha)</h2>
      <Form onSubmit={handleSearch}>
        <Form.Group as={Row} className="mb-3" controlId="formWorld">
          <Form.Label column sm="2">
            월드
          </Form.Label>
          <Col sm="10">
            <Form.Control
              as="select"
              value={world}
              onChange={(e) => setWorld(e.target.value)}
            >
              <option>스카니아</option>
              <option>베라</option>
              <option>루나</option>
              <option>제니스</option>
              <option>크로아</option>
              <option>유니온</option>
              <option>엘리시움</option>
              <option>이노시스</option>
              <option>레드</option>
              <option>오로라</option>
              <option>아케인</option>
              <option>노바</option>
              <option>리부트</option>
              <option>리부트2</option>
            </Form.Control>
          </Col>
        </Form.Group>

        <Form.Group as={Row} className="mb-3" controlId="formGuild">
          <Form.Label column sm="2">
            길드
          </Form.Label>
          <Col sm="10">
            <Form.Control
              type="text"
              placeholder="길드를 입력하세요"
              value={guild}
              onChange={(e) => setGuild(e.target.value)}
            />
          </Col>
        </Form.Group>

        <Form.Group as={Row} className="mb-3" controlId="formApiKey">
          <Form.Label column sm="2">
            API Key
          </Form.Label>
          <Col sm="10">
            <Form.Control
              type="password"
              placeholder="API 키를 입력하세요"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </Col>
        </Form.Group>

        <div className="text-center">
          <Button variant="primary" type="submit" disabled={isLoading}>
            Search
          </Button>
        </div>
      </Form>


      {isLoading && (
        <div className="mt-4">
          <ProgressBar now={progress} label={`${progress}%`}/>
        </div>
      )}


      {memberStatus.length > 0 && (
        <div className="mt-5">
          {groupByMainCharacter(memberStatus).map(([mainCharacter, members], index) => (
            <Card key={index} className="mb-4">
              <Card.Header style={{ backgroundColor: members.some(member => !member.isMainCharacterInGuild) ? "#feb9c6" : "white" }}>
                본캐: {mainCharacter} {members.some(member => !member.isMainCharacterInGuild) && "(타길드)"}
              </Card.Header>
              <Card.Body>
                <Row>
                  {members.map(({ member, isMainCharacter, characterLevel, characterClass, characterAccess, characterImage }, subIndex) => (
                    <Col md={4} key={subIndex} className="mb-4">
                      <Card style={{
                        backgroundColor: isMainCharacter ? "#d4e6f1" : "white",
                        border: characterAccess == 'false' ? '2px solid orange' : '1px solid #dee2e6' // 회색으로 설정하거나 기본 border 색상 유지
                      }}>
                        <Row noGutters>
                          {characterImage && (
                            <Col xs={4}>
                              <Card.Img
                                src={characterImage}
                                alt={`${member} 이미지`}
                                style={{ width: '100%', height: 'auto' }}
                              />
                            </Col>
                          )}
                          <Col xs={8}>
                            <Card.Body>
                              <Card.Title>{member}</Card.Title>
                              <Card.Text>
                                <strong>레벨:</strong> {characterLevel} <br />
                                <strong>직업:</strong> {characterClass} <br />
                              </Card.Text>
                            </Card.Body>
                          </Col>
                        </Row>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </Card.Body>
            </Card>
          ))}
        </div>
      )}
    </Container>
  );
}

export default SearchForm;
