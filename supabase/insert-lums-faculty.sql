-- LUMS Faculty Data
-- Extracted from lums.edu.pk
-- Date: 2025-01-09

-- Insert LUMS faculty members into teachers table
INSERT INTO teachers (name, institute, designation, city, bio, avatar_url, linkedin_url, created_at) VALUES
('Dr. Ali Cheema', 'LUMS', 'Vice Chancellor, Associate Professor of Economics', 'Lahore', 'Research interests include economic development, human capital, inclusion and economic mobility, gender, public economics, governance and political economy. Faculty Director at Mahbub Ul Haq Research Centre and Co-founder of Center for Economic Research in Pakistan (CERP).', 'https://lums.edu.pk/sites/default/files/styles/faculty_image/public/00069.jpg', NULL, NOW()),

('Dr. Ali Khan', 'LUMS', 'Dean, Associate Professor of Anthropology', 'Lahore', 'Research interests include labour issues, popular culture in Pakistan, cinema, sports, and cricket. Published multiple books on cricket, cinema, and child labour. Latest monograph "Cricket in Pakistan: Nation, Identity and Politics" published in 2022.', 'https://lums.edu.pk/sites/default/files/styles/faculty_image/public/Dr%20Ali.jpg', NULL, NOW()),

('Dr. Aisha Ahmad', 'LUMS', 'Assistant Professor', 'Lahore', 'Research focuses on land and urban governance in Lahore, Pakistan. Interested in interdisciplinary approaches to law, law and development, and political economy of law. Currently pursuing PhD at University of Oxford.', 'https://lums.edu.pk/sites/default/files/styles/faculty_image/public/aish_0_0.jpg', NULL, NOW()),

('Dr. Ali Nobil Ahmad', 'LUMS', 'Associate Professor', 'Lahore', 'Interdisciplinary social scientist, journalist, and consultant with research interests in migration, political ecology, and film and media. Former recipient of The Guardian Scott Trust bursary and has worked at universities across Asia, Africa, Europe, and US.', 'https://lums.edu.pk/sites/default/files/styles/faculty_image/public/anb.jpg', NULL, NOW()),

('Dr. Basit Shafiq', 'LUMS', 'Professor', 'Lahore', 'Research interests include information systems security and privacy, access-control management in distributed systems, web services composition and verification, ontologies, and distributed multimedia systems. Previously Research Assistant Professor at Rutgers University, USA.', 'https://lums.edu.pk/sites/default/files/styles/faculty_image/public/faculty_images/00002853.jpg', NULL, NOW()),

('Dr. Basit Yameen', 'LUMS', 'Professor', 'Lahore', 'Over 20 years of experience in polymers with research interests in functional polymers, hybrid smart materials, nanomedicine, biomedical applications, chemical and bio-sensing, light harvesting technologies, and environmental remediation. Authored over 75 research articles and book chapters.', 'https://lums.edu.pk/sites/default/files/styles/faculty_image/public/faculty_images/00002649.jpg', NULL, NOW()),

('Dr. Bushra Naqvi', 'LUMS', 'Associate Professor', 'Lahore', 'Research interests include monetary and financial economics, financial markets, international finance, financialization of natural and technological resources, corporate governance, and financial risk management. Doctorate from University of Paris 1– Panthéon Sorbonne.', 'https://lums.edu.pk/sites/default/files/styles/faculty_image/public/bnq.jpg', NULL, NOW()),

('Dr. Mariam Chughtai', 'LUMS', 'Assistant Professor, Associate Dean', 'Lahore', 'Research interests in education policy, leadership, and identity formation through education in Pakistan. Doctorate in Education from Harvard University and Director of Pakistan Programs for Harvard University Lakshmi Mittal South Asia Institute.', 'https://lums.edu.pk/sites/default/files/styles/faculty_image/public/faculty_images/00004607.jpg', NULL, NOW()),

('Dr. Murtaza Taj', 'LUMS', 'Associate Professor', 'Lahore', 'Research interests include computer vision, graphics, image processing, object detection and tracking in 2D and 3D scenes, and automatic generation of 3D models from point cloud data. Director of Computer Vision and Graphics Lab and Technology for People Initiative.', 'https://lums.edu.pk/sites/default/files/styles/faculty_image/public/faculty_images/00002860.jpg', NULL, NOW()),

('Dr. Muhammad Shoaib', 'LUMS', 'Associate Professor', 'Lahore', 'Research interests include chromatin biology and epigenetics, genome maintenance pathways, molecular mechanisms of cell transformation, DNA replication, transcription, and DNA damage response. Established Epigenome and Genome Integrity Lab (EaGIL).', 'https://lums.edu.pk/sites/default/files/styles/faculty_image/public/5.jpg', NULL, NOW()),

('Dr. Rizwan Khalid', 'LUMS', 'Associate Professor', 'Lahore', 'Faculty member in the Physics department at Syed Babar Ali School of Science and Engineering specializing in theoretical and experimental physics research.', 'https://lums.edu.pk/sites/default/files/styles/faculty_image/public/default_images/dummyUser_1_0.jpg', NULL, NOW()),

('Dr. Razia Iram Sadik', 'LUMS', 'Associate Professor', 'Lahore', 'Faculty member at Syed Ahsan Ali and Syed Maratib Ali School of Education specializing in educational research, policy analysis, and teacher education programs.', 'https://lums.edu.pk/sites/default/files/styles/faculty_image/public/faculty_images/00007183.jpg', NULL, NOW());

-- Verify insertion
SELECT name, institute, designation, city, 
       CASE WHEN bio IS NOT NULL THEN 'Yes' ELSE 'No' END as has_bio,
       CASE WHEN avatar_url IS NOT NULL THEN 'Yes' ELSE 'No' END as has_image
FROM teachers 
WHERE institute = 'LUMS'
ORDER BY name;