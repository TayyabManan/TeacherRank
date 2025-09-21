-- FAST-NUCES Faculty Data
-- Extracted from isb.nu.edu.pk
-- Date: 2025-01-09

-- Insert FAST-NUCES faculty members into teachers table
INSERT INTO teachers (name, institute, designation, city, bio, avatar_url, linkedin_url, created_at) VALUES

-- Computer Science Department
('Dr. Waseem Shahzad', 'FAST-NUCES', 'Director & Professor', 'Islamabad', 'Research interests include Data Mining, Computational Intelligence, and Machine Learning. Leading the institution as Director while maintaining active research and teaching responsibilities.', 'https://isb.nu.edu.pk/Images/Profile/CS/4553-3.jpg', NULL, NOW()),

('Dr. Hasan Mujtaba', 'FAST-NUCES', 'Head, School of Computing & Professor', 'Islamabad', 'Specializes in Artificial Intelligence, Machine Learning, and Data Mining. Leading the School of Computing to advance technological education and research.', 'https://isb.nu.edu.pk/Images/Profile/CS/4551.jpg', NULL, NOW()),

('Dr. Muhammad Arshad Islam', 'FAST-NUCES', 'HoD (Computer Science) & Professor', 'Islamabad', 'Expert in Opportunistic Networks and Social Network Analysis. Heads the Computer Science department with focus on advancing network research and computational sciences.', 'https://isb.nu.edu.pk/Images/Profile/CS/5724.jpg', NULL, NOW()),

('Dr. Ahmad Din', 'FAST-NUCES', 'HoD (AI & Data Science) & Professor', 'Islamabad', 'Leading researcher in Artificial Intelligence, Robotics, and Machine Learning. Heads the AI & Data Science department, driving innovation in intelligent systems.', 'https://isb.nu.edu.pk/Images/Profile/CS/5798.jpg', NULL, NOW()),

('Dr. Usman Habib', 'FAST-NUCES', 'HoD (Software Engineering) & Professor', 'Islamabad', 'Expert in Machine Learning, Data Analytics, and Software Engineering. Leads the Software Engineering department with focus on modern development practices and AI integration.', 'https://isb.nu.edu.pk/Images/Profile/CS/5926.jpg', NULL, NOW()),

-- Electrical Engineering Department
('Dr. Muhammad Tariq', 'FAST-NUCES', 'Head of Department & Professor', 'Islamabad', 'Leading the Electrical Engineering department with expertise in advanced electrical systems and engineering education.', 'https://isb.nu.edu.pk/Images/Profile/EE/1001.jpg', NULL, NOW()),

('Dr. Waseem Ikram', 'FAST-NUCES', 'Professor', 'Islamabad', 'Professor of Electrical Engineering with extensive research contributions in electrical systems and power engineering.', 'https://isb.nu.edu.pk/Images/Profile/EE/5733.jpg', NULL, NOW()),

('Dr. Mukhtar Ullah', 'FAST-NUCES', 'Professor', 'Islamabad', 'Senior Professor in Electrical Engineering with focus on advanced electrical systems and engineering applications.', 'https://isb.nu.edu.pk/Images/Profile/EE/4661.jpg', NULL, NOW()),

('Dr. Rashad Ramzan', 'FAST-NUCES', 'Professor', 'Islamabad', 'Professor of Electrical Engineering specializing in telecommunications and signal processing.', 'https://isb.nu.edu.pk/Images/Profile/EE/3931.jpg', NULL, NOW()),

('Dr. Niaz Ahmed', 'FAST-NUCES', 'Associate Professor', 'Islamabad', 'Research focus on underwater wireless communication systems and marine technology applications.', 'https://isb.nu.edu.pk/Images/Profile/EE/5777.jpg', NULL, NOW()),

('Dr. Arshad Hassan Khan', 'FAST-NUCES', 'Associate Professor', 'Islamabad', 'Specializes in printed sensors and artificial intelligence applications in electrical engineering.', 'https://isb.nu.edu.pk/Images/Profile/EE/6128.jpg', NULL, NOW()),

('Dr. Farhan Khalid', 'FAST-NUCES', 'Assistant Professor', 'Islamabad', 'Research interests in wireless communications and next-generation network technologies.', 'https://isb.nu.edu.pk/Images/Profile/EE/6152.jpg', NULL, NOW()),

-- Management Sciences Department
('Dr. Sadia Nadeem', 'FAST-NUCES', 'Professor, Dean (MS) & HOS', 'Islamabad', 'Leading the Management Sciences faculty as Dean and Head of School with expertise in organizational management and leadership.', 'https://isb.nu.edu.pk/Images/Profile/FSM/4605.jpg', NULL, NOW()),

('Dr. Muhammad Hanif Akhtar', 'FAST-NUCES', 'Professor of Finance', 'Islamabad', 'Expert in Finance with research focus on financial markets, corporate finance, and investment analysis.', 'https://isb.nu.edu.pk/Images/Profile/FSM/5878.jpg', NULL, NOW()),

('Dr. Muhammad Abbas', 'FAST-NUCES', 'Professor', 'Islamabad', 'Specializes in Positive Organizational Behavior, leadership development, and job stressors research.', 'https://isb.nu.edu.pk/Images/Profile/FSM/1079.jpg', NULL, NOW()),

('Dr. Muhammad Yasir', 'FAST-NUCES', 'Associate Professor', 'Islamabad', 'Research interests include Behavioral Finance and Financial Markets analysis with focus on investor psychology.', 'https://isb.nu.edu.pk/Images/Profile/FSM/5880.png', NULL, NOW()),

-- Science & Humanities Department
('Dr. M. Usman Ashraf', 'FAST-NUCES', 'Professor', 'Islamabad', 'Expert in Applied Mathematics and Fluid Mechanics with extensive research in computational methods.', 'https://isb.nu.edu.pk/Images/Profile/SH/4696.jpg', NULL, NOW()),

('Dr. Syed Irfan Shah', 'FAST-NUCES', 'Professor', 'Islamabad', 'Specializes in Fluid Mechanics, Applied and Computational Mathematics with focus on numerical solutions.', 'https://isb.nu.edu.pk/Images/Profile/SH/6039.jpg', NULL, NOW()),

('Dr. Muhammad Tayyeb Nadeem', 'FAST-NUCES', 'Professor', 'Islamabad', 'Professor of Islamic Studies with research in various religious and philosophical domains.', 'https://isb.nu.edu.pk/Images/Profile/SH/5779.jpg', NULL, NOW()),

('Dr. Hamda Khan', 'FAST-NUCES', 'Associate Professor', 'Islamabad', 'Research focus on optimization, mathematical modeling, and computational methods for real-world applications.', 'https://isb.nu.edu.pk/Images/Profile/SH/5905.jpg', NULL, NOW()),

('Dr. Khadija Farooq', 'FAST-NUCES', 'Incharge (S&H) & Assistant Professor', 'Islamabad', 'Leading Sciences & Humanities coordination while contributing to research and teaching in interdisciplinary studies.', 'https://isb.nu.edu.pk/Images/Profile/SH/5864.jpg', NULL, NOW()),

('Dr. Mehwish Hassan', 'FAST-NUCES', 'Assistant Professor', 'Islamabad', 'Specializes in Electrochemical Characterization of Nanomaterials with applications in energy and environmental sciences.', 'https://isb.nu.edu.pk/Images/Profile/SH/6083.jpg', NULL, NOW());

-- Verify insertion
SELECT name, institute, designation, city, 
       CASE WHEN bio IS NOT NULL THEN 'Yes' ELSE 'No' END as has_bio,
       CASE WHEN avatar_url IS NOT NULL THEN 'Yes' ELSE 'No' END as has_image
FROM teachers 
WHERE institute = 'FAST-NUCES'
ORDER BY name;