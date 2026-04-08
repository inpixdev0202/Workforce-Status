import { initializeDatabase, run, get } from './db.js';

// Initialize database first
await initializeDatabase();

const employees = [
    { name: '강승현', phone: '010-5413-8094', employment_type: '정규직', birth_date: '1984-03-23', age: 41, education: '학사', experience: '11년 0개월 18일', grade: '고급기술자' },
    { name: '국아영', phone: '010-4322-7751', employment_type: '정규직', birth_date: '1987-03-28', age: 38, education: '학사', experience: '11년 6개월 26일', grade: '고급기술자' },
    { name: '권지영', phone: '010-8235-7013', employment_type: '정규직', birth_date: '1986-10-12', age: 39, education: '학사', experience: '8년 10개월 12일', grade: '중급기술자' },
    { name: '김가연', phone: '010-7616-9280', employment_type: '정규직', birth_date: '1998-09-28', age: 27, education: '전문학사', experience: '6년 3개월 16일', grade: '초급기술자' },
    { name: '김강훈', phone: '010-3951-9023', employment_type: '정규직', birth_date: '1979-10-23', age: 46, education: '학사', experience: '9년 2개월 0일', grade: '고급기술자' },
    { name: '김광인', phone: '010-6769-0531', employment_type: '정규직', birth_date: '1984-11-04', age: 41, education: '전문학사', experience: '16년 8개월 28일', grade: '특급기술자' },
    { name: '김규연', phone: '010-5156-4241', employment_type: '정규직', birth_date: '1985-10-25', age: 40, education: '학사', experience: '12년 6개월 14일', grade: '특급기술자' },
    { name: '김나연', phone: '010-2340-7353', employment_type: '정규직', birth_date: '1998-02-07', age: 28, education: '학사', experience: '4년 8개월 24일', grade: '초급기술자' },
    { name: '김미희', phone: '010-4185-4328', employment_type: '정규직', birth_date: '1989-09-01', age: 36, education: '학사', experience: '11년 10개월 6일', grade: '고급기술자' },
    { name: '김민준', phone: '010-8496-1123', employment_type: '정규직', birth_date: '1984-11-23', age: 41, education: '학사', experience: '12년 5개월 24일', grade: '특급기술자' },
    { name: '김민지', phone: '010-3152-1235', employment_type: '정규직', birth_date: '1988-01-30', age: 38, education: '학사', experience: '7년 11개월 9일', grade: '중급기술자' },
    { name: '김성태', phone: '010-4084-8414', employment_type: '정규직', birth_date: '1984-06-01', age: 41, education: '전문학사', experience: '14년 1개월 17일', grade: '고급기술자' },
    { name: '김영준', phone: '010-6384-3606', employment_type: '정규직', birth_date: '1982-11-30', age: 43, education: '고졸', experience: '17년 11개월 11일', grade: '고급기술자' },
    { name: '김원욱', phone: '010-6778-9037', employment_type: '정규직', birth_date: '1982-04-20', age: 43, education: '학사', experience: '14년 10개월 24일', grade: '특급기술자' },
    { name: '김유경', phone: '010-9631-7176', employment_type: '정규직', birth_date: '1987-07-20', age: 38, education: '학사', experience: '9년 0개월 5일', grade: '고급기술자' },
    { name: '김유진', phone: '010-8981-7229', employment_type: '정규직', birth_date: '1993-01-13', age: 33, education: '전문학사', experience: '8년 1개월 0일', grade: '초급기술자' },
    { name: '김윤아', phone: '010-4937-9272', employment_type: '정규직', birth_date: '1992-03-02', age: 33, education: '학사', experience: '8년 8개월 27일', grade: '중급기술자' },
    { name: '김윤정', phone: '010-6815-8087', employment_type: '정규직', birth_date: '1995-10-04', age: 30, education: '학사', experience: '4년 11개월 10일', grade: '초급기술자' },
    { name: '김윤하', phone: '010-7913-7103', employment_type: '정규직', birth_date: '1990-06-06', age: 35, education: '학사', experience: '9년 0개월 25일', grade: '고급기술자' },
    { name: '김이정', phone: '010-6434-5416', employment_type: '정규직', birth_date: '1998-07-09', age: 27, education: '학사', experience: '3년 8개월 16일', grade: '초급기술자' },
    { name: '김재중', phone: '010-8925-6540', employment_type: '정규직', birth_date: '1978-04-21', age: 47, education: '학사', experience: '13년 11개월 10일', grade: '특급기술자' },
    { name: '김종식', phone: '010-4300-3893', employment_type: '정규직', birth_date: '1980-11-01', age: 45, education: '학사', experience: '9년 6개월 23일', grade: '고급기술자' },
    { name: '김지현A', phone: '010-8938-2800', employment_type: '정규직', birth_date: '1982-01-31', age: 44, education: '전문학사', experience: '18년 6개월 18일', grade: '특급기술자' },
    { name: '김지현B', phone: '010-2788-3625', employment_type: '정규직', birth_date: '1979-07-19', age: 46, education: '전문학사', experience: '10년 7개월 21일', grade: '중급기술자' },
    { name: '김채연', phone: '010-5537-2534', employment_type: '정규직', birth_date: '2002-06-15', age: 23, education: '전문학사', experience: '2년 11개월 10일', grade: '초급기술자' },
    { name: '김태호', phone: '010-4438-1219', employment_type: '정규직', birth_date: '1978-12-19', age: 47, education: '전문학사', experience: '23년 8개월 9일', grade: '특급기술자' },
    { name: '김현우', phone: '010-4302-3318', employment_type: '정규직', birth_date: '1975-02-14', age: 50, education: '학사', experience: '21년 8개월 14일', grade: '특급기술자' },
    { name: '김혜진', phone: '010-3158-1486', employment_type: '정규직', birth_date: '1990-06-24', age: 35, education: '학사', experience: '9년 5개월 24일', grade: '고급기술자' },
    { name: '김효진', phone: '010-9410-8404', employment_type: '정규직', birth_date: '1987-09-24', age: 38, education: '학사', experience: '14년 3개월 24일', grade: '특급기술자' },
    { name: '김희수', phone: '010-7136-8181', employment_type: '정규직', birth_date: '1986-01-22', age: 40, education: '학사', experience: '13년 6개월 25일', grade: '특급기술자' },
    { name: '명숙인', phone: '010-2742-0070', employment_type: '정규직', birth_date: '1981-03-10', age: 44, education: '전문학사', experience: '17년 1개월 17일', grade: '특급기술자' },
    { name: '모희서', phone: '010-4910-8260', employment_type: '정규직', birth_date: '1994-11-04', age: 31, education: '학사', experience: '2년 10개월 8일', grade: '초급기술자' },
    { name: '박가현', phone: '010-7191-2031', employment_type: '정규직', birth_date: '1988-09-17', age: 37, education: '학사', experience: '13년 4개월 26일', grade: '특급기술자' },
    { name: '박두완', phone: '010-2579-7043', employment_type: '정규직', birth_date: '1979-11-28', age: 46, education: '고졸', experience: '18년 2개월 16일', grade: '고급기술자' },
    { name: '박문홍', phone: '010-2936-1216', employment_type: '정규직', birth_date: '1975-03-09', age: 50, education: '석사', experience: '14년 4개월 11일', grade: '특급기술자' },
    { name: '박병철', phone: '010-7179-3690', employment_type: '정규직', birth_date: '1990-01-10', age: 36, education: '고졸', experience: '4년 4개월 24일', grade: '초급기술자' },
    { name: '박성희', phone: '010-6356-8783', employment_type: '정규직', birth_date: '1990-08-14', age: 35, education: '석사', experience: '1년 11개월 26일', grade: '초급기술자' },
    { name: '박수정', phone: '010-5789-7044', employment_type: '정규직', birth_date: '1980-10-13', age: 45, education: '학사', experience: '20년 5개월 18일', grade: '특급기술자', certification: '정보처리기사' },
    { name: '박용범', phone: '010-4719-6201', employment_type: '정규직', birth_date: '1996-02-01', age: 30, education: '학사', experience: '2년 11개월 29일', grade: '초급기술자', certification: '정보처리기사' },
    { name: '박원규', phone: '010-6326-0104', employment_type: '정규직', birth_date: '1974-11-23', age: 51, education: '학사', experience: '21년 6개월 8일', grade: '특급기술자' },
    { name: '박유미', phone: '010-6240-1052', employment_type: '정규직', birth_date: '1976-08-11', age: 49, education: '학사', experience: '25년 8개월 14일', grade: '특급기술자' },
    { name: '박윤정', phone: '010-8926-7232', employment_type: '정규직', birth_date: '1994-02-04', age: 32, education: '전문학사', experience: '8년 6개월 27일', grade: '초급기술자' },
    { name: '박재한', phone: '010-9593-0603', employment_type: '정규직', birth_date: '1983-06-03', age: 42, education: '학사', experience: '13년 2개월 20일', grade: '특급기술자' },
    { name: '박종진', phone: '010-2201-6465', employment_type: '정규직', birth_date: '1991-01-19', age: 35, education: '학사', experience: '7년 2개월 27일', grade: '중급기술자' },
    { name: '박준영A', phone: '010-2114-9872', employment_type: '정규직', birth_date: '1983-05-06', age: 42, education: '전문학사', experience: '13년 6개월 23일', grade: '고급기술자' },
    { name: '박준영B', phone: '010-6309-7224', employment_type: '정규직', birth_date: '1993-06-04', age: 32, education: '학사', experience: '4년 4개월 5일', grade: '초급기술자' },
    { name: '박혜리', phone: '010-9286-5977', employment_type: '정규직', birth_date: '1992-09-29', age: 33, education: '학사', experience: '9년 0개월 0일', grade: '고급기술자', certification: '정보처리기사' },
    { name: '백청욱', phone: '010-9046-8540', employment_type: '정규직', birth_date: '1977-03-15', age: 48, education: '전문학사', experience: '16년 0개월 14일', grade: '특급기술자' },
    { name: '서선희', phone: '010-4105-8431', employment_type: '정규직', birth_date: '1990-05-19', age: 35, education: '전문학사', experience: '10년 10개월 24일', grade: '중급기술자' },
    { name: '서유라', phone: '010-3336-5467', employment_type: '정규직', birth_date: '1990-12-06', age: 35, education: '전문학사', experience: '8년 1개월 7일', grade: '초급기술자' },
    { name: '서정욱', phone: '010-4368-1983', employment_type: '정규직', birth_date: '1983-11-26', age: 42, education: '학사', experience: '11년 1개월 15일', grade: '고급기술자' },
    { name: '서지호', phone: '010-2756-1906', employment_type: '정규직', birth_date: '1996-04-13', age: 29, education: '학사', experience: '4년 0개월 4일', grade: '중급기술자', certification: '정보처리기사' },
    { name: '설성학', phone: '010-7153-2165', employment_type: '정규직', birth_date: '1995-02-21', age: 30, education: '학사', experience: '1년 9개월 19일', grade: '초급기술자' },
    { name: '손서영', phone: '010-7512-4501', employment_type: '정규직', birth_date: '1987-12-09', age: 38, education: '학사', experience: '14년 3개월 4일', grade: '특급기술자' },
    { name: '송민근', phone: '010-2226-9453', employment_type: '정규직', birth_date: '1992-12-20', age: 33, education: '고졸', experience: '5년 10개월 18일', grade: '초급기술자' },
    { name: '송정민', phone: '010-3822-4963', employment_type: '정규직', birth_date: '1979-07-10', age: 46, education: '학사', experience: '20년 7개월 2일', grade: '특급기술자', certification: '정보처리기사' },
    { name: '신지원', phone: '010-3563-1043', employment_type: '정규직', birth_date: '2002-09-09', age: 23, education: '전문학사', experience: '1년 11개월 20일', grade: '초급기술자' },
    { name: '신한나', phone: '010-5533-9855', employment_type: '정규직', birth_date: '1992-12-29', age: 33, education: '학사', experience: '6년 7개월 7일', grade: '중급기술자' },
    { name: '심준수', phone: '010-4146-3979', employment_type: '정규직', birth_date: '1992-06-01', age: 33, education: '학사', experience: '6년 2개월 19일', grade: '중급기술자' },
    { name: '안명철', phone: '010-6342-0472', employment_type: '정규직', birth_date: '1975-12-15', age: 50, education: '학사', experience: '21년 10개월 13일', grade: '특급기술자', certification: '정보처리기사' },
    { name: '양재일', phone: '010-8522-1337', employment_type: '정규직', birth_date: '1986-06-28', age: 39, education: '학사', experience: '12년 0개월 18일', grade: '특급기술자' },
    { name: '오허정', phone: '010-8293-7015', employment_type: '정규직', birth_date: '1994-07-15', age: 31, education: '학사', experience: '4년 4개월 29일', grade: '초급기술자' },
    { name: '오훈', phone: '010-2060-8000', employment_type: '정규직', birth_date: '1975-05-08', age: 50, education: '학사', experience: '20년 3개월 22일', grade: '특급기술자', certification: '정보처리기사' },
    { name: '원명연', phone: '010-8750-7166', employment_type: '정규직', birth_date: '1992-06-28', age: 33, education: '학사', experience: '7년 3개월 21일', grade: '중급기술자' },
    { name: '유호경', phone: '010-8979-3897', employment_type: '정규직', birth_date: '1991-09-08', age: 34, education: '전문학사', experience: '5년 6개월 29일', grade: '초급기술자', certification: '정보처리산업기사' },
    { name: '윤경미', phone: '010-5184-1035', employment_type: '정규직', birth_date: '1994-04-12', age: 31, education: '학사', experience: '4년 1개월 4일', grade: '초급기술자' },
    { name: '윤수진', phone: '010-3447-2456', employment_type: '정규직', birth_date: '1980-06-26', age: 45, education: '전문학사', experience: '15년 1개월 8일', grade: '특급기술자' },
    { name: '이동찬', phone: '010-5296-8798', employment_type: '정규직', birth_date: '1977-05-27', age: 48, education: '학사', experience: '16년 6개월 23일', grade: '특급기술자' },
    { name: '이선영', phone: '010-3346-9494', employment_type: '정규직', birth_date: '1994-11-11', age: 31, education: '전문학사', experience: '11년 0개월 11일', grade: '중급기술자' },
    { name: '이소현', phone: '010-9116-9938', employment_type: '정규직', birth_date: '2000-01-01', age: 26, education: '전문학사', experience: '4년 10개월 0일', grade: '초급기술자' },
    { name: '이수연', phone: '', employment_type: '프리랜서', birth_date: '1982-05-05', age: 43, education: '학사', experience: '14년 3개월 26일', grade: '특급기술자' },
    { name: '이애린', phone: '010-8920-8950', employment_type: '정규직', birth_date: '1984-09-18', age: 41, education: '고졸', experience: '16년 5개월 18일', grade: '고급기술자' },
    { name: '이윤영', phone: '010-8070-0260', employment_type: '정규직', birth_date: '1996-05-28', age: 29, education: '전문학사', experience: '3년 4개월 26일', grade: '초급기술자' },
    { name: '이인진', phone: '010-8922-2832', employment_type: '정규직', birth_date: '1992-04-24', age: 33, education: '학사', experience: '8년 6개월 22일', grade: '고급기술자', certification: '정보처리기사' },
    { name: '이재찬', phone: '010-9071-4816', employment_type: '정규직', birth_date: '1976-01-02', age: 50, education: '학사', experience: '23년 1개월 19일', grade: '특급기술자', certification: '정보처리기사' },
    { name: '이재호', phone: '010-6224-5330', employment_type: '정규직', birth_date: '1973-12-21', age: 52, education: '학사', experience: '22년 2개월 26일', grade: '특급기술자' },
    { name: '이정훈', phone: '010-2287-4796', employment_type: '정규직', birth_date: '1983-01-21', age: 43, education: '전문학사', experience: '15년 9개월 14일', grade: '특급기술자' },
    { name: '이주현', phone: '010-7478-8785', employment_type: '정규직', birth_date: '1987-08-05', age: 38, education: '학사', experience: '9년 3개월 12일', grade: '고급기술자' },
    { name: '이지선', phone: '', employment_type: '프리랜서', birth_date: '1975-03-08', age: 50, education: '전문학사', experience: '12년 11개월 20일', grade: '고급기술자' },
    { name: '이지현', phone: '010-9960-3273', employment_type: '정규직', birth_date: '1991-02-20', age: 34, education: '학사', experience: '10년 7개월 22일', grade: '고급기술자' },
    { name: '이하늬', phone: '010-2032-5731', employment_type: '정규직', birth_date: '1996-01-13', age: 30, education: '학사', experience: '2년 11개월 17일', grade: '초급기술자' },
    { name: '이헌모', phone: '010-5397-8576', employment_type: '정규직', birth_date: '1981-06-04', age: 44, education: '전문학사', experience: '14년 9개월 4일', grade: '고급기술자' },
    { name: '임근혜', phone: '010-2522-8075', employment_type: '정규직', birth_date: '1996-03-29', age: 29, education: '학사', experience: '4년 8개월 5일', grade: '초급기술자' },
    { name: '임새얀', phone: '010-7721-8110', employment_type: '정규직', birth_date: '1997-12-09', age: 28, education: '학사', experience: '4년 7개월 2일', grade: '초급기술자' },
    { name: '장욱', phone: '010-9494-8932', employment_type: '정규직', birth_date: '1983-09-25', age: 42, education: '학사', experience: '12년 0개월 29일', grade: '특급기술자' },
    { name: '장혜임', phone: '010-9569-0215', employment_type: '정규직', birth_date: '1995-02-15', age: 30, education: '석사', experience: '3년 3개월 22일', grade: '중급기술자' },
    { name: '전민영', phone: '010-9117-6498', employment_type: '정규직', birth_date: '1984-08-19', age: 41, education: '학사', experience: '17년 1개월 20일', grade: '특급기술자' },
    { name: '정민재', phone: '010-2441-6151', employment_type: '정규직', birth_date: '1992-12-25', age: 33, education: '학사', experience: '7년 11개월 12일', grade: '중급기술자' },
    { name: '정새롬', phone: '010-5670-4914', employment_type: '정규직', birth_date: '1991-05-12', age: 34, education: '전문학사', experience: '7년 3개월 16일', grade: '초급기술자' },
    { name: '정선희', phone: '010-6309-1019', employment_type: '정규직', birth_date: '1981-10-19', age: 44, education: '전문학사', experience: '15년 10개월 10일', grade: '특급기술자' },
    { name: '정세빈', phone: '010-8941-5810', employment_type: '정규직', birth_date: '1990-02-13', age: 35, education: '전문학사', experience: '11년 8개월 20일', grade: '중급기술자' },
    { name: '정수진', phone: '010-9060-0771', employment_type: '정규직', birth_date: '1990-12-16', age: 35, education: '학사', experience: '8년 6개월 9일', grade: '고급기술자', certification: '정보처리기사' },
    { name: '정이주', phone: '010-4934-2770', employment_type: '정규직', birth_date: '1996-04-10', age: 29, education: '전문학사', experience: '7년 11개월 11일', grade: '초급기술자' },
    { name: '정재홍', phone: '010-9382-2218', employment_type: '정규직', birth_date: '1981-11-07', age: 44, education: '학사', experience: '18년 8개월 13일', grade: '특급기술자', certification: '정보처리기사' },
    { name: '정정아', phone: '010-2825-4494', employment_type: '정규직', birth_date: '1997-09-30', age: 28, education: '고졸', experience: '7년 4개월 12일', grade: '초급기술자' },
    { name: '정지혜', phone: '010-4557-2187', employment_type: '정규직', birth_date: '1989-12-11', age: 36, education: '학사', experience: '12년 11개월 12일', grade: '특급기술자' },
    { name: '정하빈', phone: '010-2285-4024', employment_type: '정규직', birth_date: '2001-07-16', age: 24, education: '학사', experience: '2년 10개월 27일', grade: '초급기술자' },
    { name: '정현아', phone: '010-3225-5412', employment_type: '정규직', birth_date: '1994-06-25', age: 31, education: '전문학사', experience: '6년 4개월 27일', grade: '초급기술자' },
    { name: '조병성', phone: '010-3474-1628', employment_type: '정규직', birth_date: '1972-01-05', age: 54, education: '학사', experience: '24년 11개월 3일', grade: '특급기술자' },
    { name: '조윤지', phone: '010-6696-3620', employment_type: '정규직', birth_date: '1995-04-02', age: 30, education: '전문학사', experience: '4년 10개월 25일', grade: '초급기술자' },
    { name: '최성수', phone: '010-4388-0630', employment_type: '정규직', birth_date: '1996-06-10', age: 29, education: '학사', experience: '2년 10개월 8일', grade: '초급기술자' },
    { name: '한상욱', phone: '010-5476-0350', employment_type: '정규직', birth_date: '1988-09-13', age: 37, education: '학사', experience: '10년 9개월 26일', grade: '특급기술자', certification: '정보처리기사' },
    { name: '허정학', phone: '010-8589-1858', employment_type: '정규직', birth_date: '1976-02-03', age: 50, education: '고졸', experience: '22년 0개월 2일', grade: '특급기술자', certification: '정보처리기사' },
    { name: '홍유진', phone: '010-9161-6564', employment_type: '정규직', birth_date: '2001-06-30', age: 24, education: '학사', experience: '1년 11개월 20일', grade: '초급기술자' },
    { name: '황경수', phone: '010-2132-0202', employment_type: '정규직', birth_date: '1977-01-19', age: 49, education: '고졸', experience: '22년 8개월 22일', grade: '고급기술자' },
    { name: '황호진', phone: '010-8833-0870', employment_type: '정규직', birth_date: '1989-08-14', age: 36, education: '학사', experience: '5년 11개월 2일', grade: '초급기술자' }
];

console.log(`총 ${employees.length}명의 직원 데이터를 가져왔습니다.`);

// Calculate join_date from experience (approximate)
function calculateJoinDate(experience) {
    const match = experience.match(/(\d+)년\s*(\d+)개월/);
    if (match) {
        const years = parseInt(match[1]);
        const months = parseInt(match[2]);
        const today = new Date();
        const joinDate = new Date(today.getFullYear() - years, today.getMonth() - months, today.getDate());
        return joinDate.toISOString().split('T')[0];
    }
    return null;
}

let successCount = 0;
let errorCount = 0;

for (const emp of employees) {
    try {
        const joinDate = calculateJoinDate(emp.experience);
        const notes = [];

        if (emp.education) notes.push(`학력: ${emp.education}`);
        if (emp.grade) notes.push(`등급: ${emp.grade}`);
        if (emp.certification) notes.push(`자격증: ${emp.certification}`);
        if (emp.experience) notes.push(`경력: ${emp.experience}`);

        run(`
      INSERT INTO employees (
        name, contact_phone, employment_type, join_date, 
        position, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
            emp.name,
            emp.phone || null,
            emp.employment_type,
            joinDate,
            emp.grade || null,
            'active',
            notes.join(' | ')
        ]);

        successCount++;
        console.log(`✓ ${emp.name} 추가 완료`);
    } catch (error) {
        errorCount++;
        console.error(`✗ ${emp.name} 추가 실패:`, error.message);
    }
}

console.log(`\n완료: 성공 ${successCount}명, 실패 ${errorCount}명`);
process.exit(0);
