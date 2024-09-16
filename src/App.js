// SearchForm.js

import React, { useState } from 'react';
import { Form, Button, Container, Row, Col, Card, ProgressBar } from 'react-bootstrap';

function SearchForm() {
  const [world, setWorld] = useState('엘리시움');
  const [guild, setGuild] = useState('');
  const [memberStatus, setMemberStatus] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();

    setIsLoading(true);

    try {
      const response = await fetch('/api/guild/members', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ guild, world }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch data from server');
      }

      const data = await response.json();

      setMemberStatus(data.memberStatus);

      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching data from server:', error);
      setIsLoading(false);
    }
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
      <h2 className="text-center mb-4">길드원 관리 (Beta)</h2>
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
              {/* 월드 옵션들 */}
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

        <div className="text-center">
          <Button variant="primary" type="submit" disabled={isLoading}>
            검색
          </Button>
        </div>
      </Form>

      {isLoading && (
        <div className="mt-4">
          <ProgressBar animated now={100} label={`로딩 중...`}/>
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
                        border: characterAccess === 'false' ? '2px solid orange' : '1px solid #dee2e6'
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
                          <Col xs={characterImage ? 8 : 12}>
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
