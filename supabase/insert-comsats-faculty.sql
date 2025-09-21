-- COMSATS University Faculty Test Data
-- Extracted from ww2.comsats.edu.pk
-- Date: 2025-01-09

-- Insert COMSATS faculty members into teachers table
INSERT INTO teachers (name, institute, designation, city, bio, avatar_url, linkedin_url, created_at) VALUES
('Dr. Muhammad Shahzad Khurram', 'COMSATS', 'Assistant Professor', 'Lahore', 'Dr. Muhammad Shahzad Khurram is an Assistant Professor in the Chemical Engineering Department at COMSATS University Lahore Campus. He completed his PhD (2015) from Konkuk University, South Korea. His research focuses on biomass energy, waste biomass valorization, biofuel production, and fluidized bed technologies.', NULL, NULL, NOW()),

('Dr. Aamir Ali', 'COMSATS', 'Associate Professor', 'Attock', 'Dr. Aamir Ali is currently working as Associate Professor in the Department of Mathematics. He completed his PhD in Mathematics from COMSATS and Post-Doctorate in 2014 from University de Nice Sophia Antipolis, France. His research focus is on Fluid Mechanics with over 50 published papers.', 'http://ww2.comsats.edu.pk/faculty/FacultyPics/09_01_2023_11_21_18_9229887.jpg', NULL, NOW()),

('Dr. Aamir Qamar', 'COMSATS', 'Tenured Associate Professor', 'Wah', NULL, 'http://ww2.comsats.edu.pk/faculty/FacultyPics/17_10_2016_16_05_47_0699557.jpg', NULL, NOW()),

('Dr. Aamir Sanaullah', 'COMSATS', 'Assistant Professor', 'Lahore', 'Dr. Aamir Sanaullah earned his PhD in Statistics from National College of Business Administration and Economics Lahore. He has over 7 years of teaching and research experience. His research interests include Survey Sampling, Non-response analysis, and Statistical Quality Control with over 45 published research papers.', NULL, NULL, NOW()),

('Dr. Aamir Shahzad', 'COMSATS', 'Associate Professor', 'Abbottabad', 'Dr. Aamir Shahzad is an Associate Professor in the Computer Engineering Department. His recent research includes work on medical image segmentation and implementation of modified U-Net for medical image segmentation on edge devices.', NULL, NULL, NOW()),

('Dr. Aasia Nusrat', 'COMSATS', 'Associate Professor', 'Lahore', 'Dr. Aasia Nusrat has completed her MS and PhD from the University of Nantes, France. She teaches modules including Bilingualism, English Language Teaching, and Research Methodology. She speaks English, Urdu, Saraiki, Punjabi, and French.', NULL, NULL, NOW()),

('Dr. Abbas Javed', 'COMSATS', 'Assistant Professor', 'Lahore', 'Dr. Abbas Javed is an Assistant Professor in the Electrical Engineering Department. His research focuses on phenomenological modeling of memristors, smart controllers, and renewable energy systems for electric vehicle parking lots.', NULL, NULL, NOW());

-- Verify insertion
SELECT name, institute, designation, city, 
       CASE WHEN bio IS NOT NULL THEN 'Yes' ELSE 'No' END as has_bio,
       CASE WHEN avatar_url IS NOT NULL THEN 'Yes' ELSE 'No' END as has_image
FROM teachers 
WHERE institute = 'COMSATS'
ORDER BY name;