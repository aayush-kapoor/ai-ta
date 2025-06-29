import { toast } from 'sonner'
import { Course, Assignment, Submission, CourseEnrollment, User, RubricItem } from '../types'

// Mock data
const mockCourses: Course[] = [
  {
    id: 'course-1',
    title: 'Introduction to Computer Science',
    description: 'A comprehensive introduction to computer science concepts and programming fundamentals.',
    course_code: 'CS500',
    teacher_id: 'teacher-1',
    created_at: new Date().toISOString()
  },
  {
    id: 'course-2',
    title: 'Data Structures and Algorithms',
    description: 'Advanced study of data structures and algorithmic problem-solving techniques.',
    course_code: 'CS201',
    teacher_id: 'teacher-1',
    created_at: new Date().toISOString()
  },
  {
    id: 'course-3',
    title: 'Web Development Fundamentals',
    description: 'Learn HTML, CSS, JavaScript, and modern web development frameworks.',
    course_code: 'WEB101',
    teacher_id: 'teacher-1',
    created_at: new Date().toISOString()
  }
]

const mockAssignments: Assignment[] = [
  {
    id: 'assignment-1',
    title: 'Hello World Program',
    description: 'Create your first program that prints "Hello, World!" to the console.',
    instructions: 'Write a program in your preferred programming language that outputs "Hello, World!" when executed. Include comments explaining each line of code.',
    max_score: 100,
    due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
    course_id: 'course-1',
    rubric: [
      { id: 'r1', criteria: 'Code Correctness', max_points: 40, description: 'Program runs without errors and produces correct output' },
      { id: 'r2', criteria: 'Code Quality', max_points: 30, description: 'Code is well-structured and follows best practices' },
      { id: 'r3', criteria: 'Documentation', max_points: 30, description: 'Code includes clear comments and documentation' }
    ],
    created_at: new Date().toISOString()
  },
  {
    id: 'assignment-2',
    title: 'Binary Search Implementation',
    description: 'Implement the binary search algorithm and analyze its time complexity.',
    instructions: 'Implement binary search in the programming language of your choice. Include test cases and time complexity analysis.',
    max_score: 100,
    due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days from now
    course_id: 'course-2',
    rubric: [
      { id: 'r4', criteria: 'Algorithm Implementation', max_points: 50, description: 'Correct implementation of binary search' },
      { id: 'r5', criteria: 'Test Cases', max_points: 25, description: 'Comprehensive test cases covering edge cases' },
      { id: 'r6', criteria: 'Complexity Analysis', max_points: 25, description: 'Accurate time and space complexity analysis' }
    ],
    created_at: new Date().toISOString()
  },
  {
    id: 'assignment-3',
    title: 'Personal Portfolio Website',
    description: 'Create a responsive personal portfolio website using HTML, CSS, and JavaScript.',
    instructions: 'Build a multi-page portfolio website that showcases your projects and skills. Must be responsive and include interactive elements.',
    max_score: 100,
    due_date: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(), // 21 days from now
    course_id: 'course-3',
    rubric: [
      { id: 'r7', criteria: 'Design and Layout', max_points: 35, description: 'Professional design with good visual hierarchy' },
      { id: 'r8', criteria: 'Responsive Design', max_points: 30, description: 'Works well on desktop, tablet, and mobile devices' },
      { id: 'r9', criteria: 'Functionality', max_points: 35, description: 'Interactive elements work correctly and enhance user experience' }
    ],
    created_at: new Date().toISOString()
  }
]

const mockSubmissions: Submission[] = [
  {
    id: 'submission-1',
    assignment_id: 'assignment-1',
    student_id: 'student-1',
    file_name: 'hello-world.py',
    file_url: '/mock-files/hello-world.py',
    submitted_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
    grade: 95,
    feedback: 'Excellent work! Clean code with good comments.',
    graded_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'submission-2',
    assignment_id: 'assignment-2',
    student_id: 'student-2',
    file_name: 'binary-search.java',
    file_url: '/mock-files/binary-search.java',
    submitted_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
  },
  {
    id: 'submission-3',
    assignment_id: 'assignment-1',
    student_id: 'student-3',
    file_name: 'hello-world.cpp',
    file_url: '/mock-files/hello-world.cpp',
    submitted_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    grade: 88,
    feedback: 'Good implementation. Consider adding more descriptive comments.',
    graded_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  }
]

const mockEnrollments: CourseEnrollment[] = [
  {
    id: 'enrollment-1',
    course_id: 'course-1',
    student_id: 'student-1',
    enrolled_at: new Date().toISOString()
  },
  {
    id: 'enrollment-2',
    course_id: 'course-2',
    student_id: 'student-1',
    enrolled_at: new Date().toISOString()
  },
  {
    id: 'enrollment-3',
    course_id: 'course-1',
    student_id: 'student-2',
    enrolled_at: new Date().toISOString()
  },
  {
    id: 'enrollment-4',
    course_id: 'course-3',
    student_id: 'student-3',
    enrolled_at: new Date().toISOString()
  }
]

// Simulate API errors occasionally for testing
const simulateError = (operation: string) => {
  // 5% chance of error for testing
  if (Math.random() < 0.05) {
    throw new Error(`Simulated error in ${operation}`)
  }
}

// Mock API functions
export const mockAPI = {
  // Courses
  getCourses: async (): Promise<Course[]> => {
    await new Promise(resolve => setTimeout(resolve, 300)) // Simulate API delay
    try {
      simulateError('getCourses')
      return mockCourses
    } catch (error) {
      console.error('Error in getCourses:', error)
      throw error
    }
  },

  getCourse: async (id: string): Promise<Course | null> => {
    await new Promise(resolve => setTimeout(resolve, 300))
    try {
      simulateError('getCourse')
      return mockCourses.find(course => course.id === id) || null
    } catch (error) {
      console.error('Error in getCourse:', error)
      throw error
    }
  },

  createCourse: async (courseData: Omit<Course, 'id' | 'created_at'>): Promise<Course> => {
    await new Promise(resolve => setTimeout(resolve, 300))
    try {
      simulateError('createCourse')
      const newCourse: Course = {
        ...courseData,
        id: `course-${Date.now()}`,
        created_at: new Date().toISOString()
      }
      mockCourses.push(newCourse)
      return newCourse
    } catch (error) {
      console.error('Error in createCourse:', error)
      throw error
    }
  },

  // Assignments
  getAssignments: async (courseId?: string): Promise<Assignment[]> => {
    await new Promise(resolve => setTimeout(resolve, 300))
    try {
      simulateError('getAssignments')
      return courseId 
        ? mockAssignments.filter(assignment => assignment.course_id === courseId)
        : mockAssignments
    } catch (error) {
      console.error('Error in getAssignments:', error)
      throw error
    }
  },

  getAssignment: async (id: string): Promise<Assignment | null> => {
    await new Promise(resolve => setTimeout(resolve, 300))
    try {
      simulateError('getAssignment')
      return mockAssignments.find(assignment => assignment.id === id) || null
    } catch (error) {
      console.error('Error in getAssignment:', error)
      throw error
    }
  },

  createAssignment: async (assignmentData: Omit<Assignment, 'id' | 'created_at'>): Promise<Assignment> => {
    await new Promise(resolve => setTimeout(resolve, 300))
    try {
      simulateError('createAssignment')
      const newAssignment: Assignment = {
        ...assignmentData,
        id: `assignment-${Date.now()}`,
        created_at: new Date().toISOString()
      }
      mockAssignments.push(newAssignment)
      return newAssignment
    } catch (error) {
      console.error('Error in createAssignment:', error)
      throw error
    }
  },

  getAssignmentsByStudent: async (studentId: string): Promise<Assignment[]> => {
    await new Promise(resolve => setTimeout(resolve, 300))
    try {
      simulateError('getAssignmentsByStudent')
      const studentEnrollments = mockEnrollments.filter(e => e.student_id === studentId)
      const enrolledCourseIds = studentEnrollments.map(e => e.course_id)
      return mockAssignments.filter(assignment => enrolledCourseIds.includes(assignment.course_id))
    } catch (error) {
      console.error('Error in getAssignmentsByStudent:', error)
      throw error
    }
  },

  // Submissions
  getSubmissions: async (assignmentId?: string): Promise<Submission[]> => {
    await new Promise(resolve => setTimeout(resolve, 300))
    try {
      simulateError('getSubmissions')
      return assignmentId
        ? mockSubmissions.filter(submission => submission.assignment_id === assignmentId)
        : mockSubmissions
    } catch (error) {
      console.error('Error in getSubmissions:', error)
      throw error
    }
  },

  getSubmission: async (id: string): Promise<Submission | null> => {
    await new Promise(resolve => setTimeout(resolve, 300))
    try {
      simulateError('getSubmission')
      return mockSubmissions.find(submission => submission.id === id) || null
    } catch (error) {
      console.error('Error in getSubmission:', error)
      throw error
    }
  },

  createSubmission: async (submissionData: Omit<Submission, 'id' | 'submitted_at'>): Promise<Submission> => {
    await new Promise(resolve => setTimeout(resolve, 300))
    try {
      simulateError('createSubmission')
      const newSubmission: Submission = {
        ...submissionData,
        id: `submission-${Date.now()}`,
        submitted_at: new Date().toISOString()
      }
      mockSubmissions.push(newSubmission)
      return newSubmission
    } catch (error) {
      console.error('Error in createSubmission:', error)
      throw error
    }
  },

  getSubmissionsByStudent: async (studentId: string): Promise<Submission[]> => {
    await new Promise(resolve => setTimeout(resolve, 300))
    try {
      simulateError('getSubmissionsByStudent')
      return mockSubmissions.filter(submission => submission.student_id === studentId)
    } catch (error) {
      console.error('Error in getSubmissionsByStudent:', error)
      throw error
    }
  },

  updateSubmissionGrade: async (id: string, grade: number, feedback: string): Promise<Submission | null> => {
    await new Promise(resolve => setTimeout(resolve, 300))
    try {
      simulateError('updateSubmissionGrade')
      const submission = mockSubmissions.find(s => s.id === id)
      if (submission) {
        submission.grade = grade
        submission.feedback = feedback
        submission.graded_at = new Date().toISOString()
      }
      return submission || null
    } catch (error) {
      console.error('Error in updateSubmissionGrade:', error)
      throw error
    }
  },

  // Enrollments
  getStudentEnrollments: async (studentId: string): Promise<CourseEnrollment[]> => {
    await new Promise(resolve => setTimeout(resolve, 300))
    try {
      simulateError('getStudentEnrollments')
      const enrollments = mockEnrollments.filter(enrollment => enrollment.student_id === studentId)
      return enrollments.map(enrollment => ({
        ...enrollment,
        course: mockCourses.find(course => course.id === enrollment.course_id)
      }))
    } catch (error) {
      console.error('Error in getStudentEnrollments:', error)
      throw error
    }
  },

  getCourseEnrollments: async (courseId: string): Promise<CourseEnrollment[]> => {
    await new Promise(resolve => setTimeout(resolve, 300))
    try {
      simulateError('getCourseEnrollments')
      return mockEnrollments.filter(enrollment => enrollment.course_id === courseId)
    } catch (error) {
      console.error('Error in getCourseEnrollments:', error)
      throw error
    }
  },

  enrollStudent: async (courseId: string, studentId: string): Promise<CourseEnrollment> => {
    await new Promise(resolve => setTimeout(resolve, 300))
    try {
      simulateError('enrollStudent')
      const newEnrollment: CourseEnrollment = {
        id: `enrollment-${Date.now()}`,
        course_id: courseId,
        student_id: studentId,
        enrolled_at: new Date().toISOString()
      }
      mockEnrollments.push(newEnrollment)
      return newEnrollment
    } catch (error) {
      console.error('Error in enrollStudent:', error)
      throw error
    }
  },

  getAvailableCourses: async (studentId: string): Promise<Course[]> => {
    await new Promise(resolve => setTimeout(resolve, 300))
    try {
      simulateError('getAvailableCourses')
      const enrolledCourseIds = mockEnrollments
        .filter(enrollment => enrollment.student_id === studentId)
        .map(enrollment => enrollment.course_id)
      
      return mockCourses.filter(course => !enrolledCourseIds.includes(course.id))
    } catch (error) {
      console.error('Error in getAvailableCourses:', error)
      throw error
    }
  }
}