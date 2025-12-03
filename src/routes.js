import { element } from 'prop-types'
import React from 'react'

import PrivateRoute from './privateRoute'
import { roles } from './views/admin/System_User_Management/fetchedRole'

const Dashboard = React.lazy(() => import('./views/admin/dashbord/dashbord'))



// admin
const Candidate = React.lazy(() => import('./views/admin/Candidate/candidate'));
const Vote = React.lazy(()=> import('./views/admin/Vote/vote'));
const VoteStastics = React.lazy(()=> import('./views/admin/Vote_Stastics/vote_stastics'));
const Game = React.lazy(()=> import('./views/admin/Game/game'));
const Dashborad = React.lazy(()=> import('./views/admin/dashbord/dashbord'));
const Chat = React.lazy(()=> import('./views/admin/Chat/chat'));

//Serve service Request Form
const ExperienceLetter = React.lazy(()=> import('./views/admin/Experiance_Letter/Experiance_Letter'));
const LetterOfEmbassy = React.lazy(()=> import('./views/admin/Letter_Of_Embassy/Letter_Of_Embassy'));
const GuarantyLetter = React.lazy(()=> import('./views/admin/Guaranty_Letter/Guaranty_Letter'));
const SupportiveLetter = React.lazy(()=> import('./views/admin/Supportive_Letter/Supportive_Letter'))
const Assigned_To_Me = React.lazy(()=> import("./views/admin/Approval/approval"));

const Supportive = React.lazy(()=> import('./views/admin/Letters/Supportive'))
const Guaranty = React.lazy(()=> import('./views/admin/Letters/Guarenty'))
const Experiance = React.lazy(()=> import('./views/admin/Letters/Experiance'));
const BingoGame = React.lazy(()=> import('./views/admin/BingoGame/Bingo_Game_Mobile'));

const BingoTv = React.lazy(()=> import('./views/admin/BingoTv/BingoTv'));
const GoldDiggerGame = React.lazy(()=> import('./views/admin/GoldDiggerGame/GoldDiggerGame'));
const GoldDiggerMulGame = React.lazy(()=> import('./views/admin/GoldDiggerMulGame/GoldDiggerMulGame'));


const Authorize = React.lazy(()=> import('./views/admin/Authorize/Authorize'));
const Audit = React.lazy(()=> import('./views/admin/Audit/Audit'));
const BranchRecord = React.lazy(()=> import('./views/admin/Branch_Record/BranchRecord'));

const Reassignment = React.lazy(() => import('./views/admin/Reassignment/Reassignment'));

const BiometricRegistration = React.lazy(() => import('./views/admin/BiometricRegistration/BiometricRegistration'));
const BiometricApproval = React.lazy(() => import('./views/admin/BiometricRegistration/BiometricApproval'));

const User = React.lazy(()=> import('./views/user/User'));

const System_User_Management = React.lazy(() => import('./views/admin/System_User_Management/systemUserManagement'))

const routes = [
  { path: '/', exact: true, name: 'Home' },
  { path: '/dashboard', name: 'Chat', element: Chat },



  // admin component
  {
    path: '/super_admin/employee',
    name: 'Employee',
    element: System_User_Management,
    roles: ['Super_Admin']
  },

  {
    path: '/authorizer/authorize',
    name: 'Authorize',
    element: Authorize,
    roles: ['Authorizer']
  },

  {
    path: '/reassign',
    name: 'Reassignment',
    element: Reassignment,
    roles: ['Admin','Authorizer']
  },

  {
    path: '/auditor/audit',
    name: 'Audit',
    element: Audit,
    roles: ['Auditor']
  },

  {
    path: '/admin/branch_record',
    name: 'Branch Record',
    element: BranchRecord,
    roles: ['Admin','Authorizer', 'Teller', 'Maker', 'Auditor']
  },

  {
    path: '/admin/user',
    name: 'User',
    element: User,
    roles: ['Admin']
  },
  {
    path: '/teller/assigned_to_me',
    name: 'Assigned_To_Me',
    element: Assigned_To_Me,
    roles: ['Admin', 'Teller', 'Maker']
  },
  {
    path: '/teller/biometric_registration',
    name: 'Biometric Registration',
    element: BiometricRegistration,
    roles: ['Teller', 'Maker']
  },
  {
    path: '/admin/biometric_approval',
    name: 'Biometric Approval',
    element: BiometricApproval,
    roles: ['Admin']
  },
  {
    path: '/admin/experiance',
    name: 'Experiance',
    element: ExperienceLetter,
    roles: ['Admin', 'Teller', 'Maker', 'Auditor', 'Branch_Management', 'Authorizer']
  },































  {
    path: '/admin/golddigger',
    name: 'GoldDigger',
    element: GoldDiggerGame,
    roles: ['admin']
  },
  {
    path: '/admin/golddiggermul',
    name: 'GoldDiggerMul',
    element: GoldDiggerMulGame,
    roles: ['admin']
  },

  {
    path: '/admin/bingotv',
    name: 'BingoTv',
    element: BingoTv,
    roles: ['admin']
  },


  {
    path: '/admin/bingo',
    name: 'Bingo',
    element: BingoGame,
    roles: ['admin', 'user']
  },
  
  {
     path: '/admin/supportive',
    name: 'Supportive',
    element: Supportive,
    roles: ['admin', 'user']
    
  },

  {
    path: '/admin/experiance',
   name: 'Experiance',
   element: Experiance,
   roles: ['admin', 'user']
   
 },

  {
    path: '/admin/guaranty',
   name: 'Guaranty',
   element: Guaranty,
   roles: ['admin', 'user']
   
 },


 
  
 
  {
    path: '/user/embassy',
    name: 'Embassy',
    element: LetterOfEmbassy,
    roles: ['admin', 'user']
  },
  {
    path: '/user/guaranty',
    name: 'Guaranty',
    element: GuarantyLetter,
    roles: ['admin', 'user']
  },
  {
    path: '/user/supportive',
    name: 'Supportive',
    element: SupportiveLetter,
    roles: ['admin', 'user']
  },
  {
    path: '/admin/candidate',
    name: 'Candidate',
    element: Candidate,
    roles: ['admin', 'user']
  },
  {
    path: '/admin/vote',
    name: 'Vote',
    element: Vote,
    roles: ['admin','user']
  },
  {
    path: '/admin/vote_stastics',
    name: 'VoteStastics',
    element: VoteStastics,
    roles: ['admin']
  },
  {
    path: '/admin/Game',
    name: 'Game',
    element: Game,
    roles: ['admin','user']
  },
  {
    path: '/admin/dashboard',
    name: 'Dashborad',
    element: Dashborad,
    roles: ['admin']
  },
  {
    path: '/admin/chat',
    name: 'Chat',
    element: Chat,
    roles: ['Teller','CSR','Admin', 'Authorizer', 'Auditor', 'Branch_Management']
  },
  

  
]

export default routes
