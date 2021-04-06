import { Router, Request, Response, NextFunction } from 'express';
import prisma, { userModel, todoModel, listModel } from '../models';
import { isLoggedIn, isNotLoggedIn } from './middleware';
import * as passport from 'passport';
import { create } from 'node:domain';

const userRouter = Router();

userRouter.post('/signup', async (req: Request, res: Response, next: NextFunction) => {
  try {    
    class UserData {
      constructor(readonly email: string, readonly pw: string,){
      }
      public signup_isvalid(): boolean {
        const email_validator = /^[A-Za-z0-9_\.\-]+@[A-Za-z0-9\-]+\.[A-Za-z0-9\-]+/;
        if (email_validator.test(this.email) === false) {
          res.status(400).json({ 'message': '이메일 형식이 올바르지 않습니다.' })
          return false    
        }
        if (this.pw.length < 8) {
          res.status(400).json({ 'message': '패스워드는 8자 이상이어야 합니다.' })
          return false
        }
        return true
      }
    }
    const userData: UserData = new UserData(req.body.email, req.body.password)
    if (userData.signup_isvalid()) {
      const user = await userModel.findUniqueUser(req.body)
      if (user) {
        res.status(403).json({ 'message': '이미 존재하는 사용자 이메일 입니다.' })
      } else {
        const newUser = await userModel.createNewUser(userData.email, userData.pw);
        const newList = await listModel.addList(newUser.id, 'Basic', true);
        if (newUser && newList) {
          res.status(200).json({ user_id: newUser.id, list_id: newList.id });
        } else {
          res.status(400).json({ 'message': '새로 생성된 사용자가 없습니다.'})
        }
      } 
    }
    
  } catch (err) {
    console.error(err);
    next(err);
  }
});

userRouter.post('/login', isNotLoggedIn, (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('local', (err: Error, user, info: { message: string }) => {
    if (info) {
      return res.status(401).json(info.message);
    }
    if (err) {
      console.error(err);
      return next(err);
    }
    return req.login(user, async (loginErr: Error) => {
      try {
        if (loginErr) {
          return next(loginErr);
        }
        const userInfo = await userModel.findUniqueUser( { id: user.id } )

        return res.status(200).json(userInfo)
      } catch (err) {
        console.error(err);
        next(err);
      }
    });
  })(req, res, next);
});

// logout
userRouter.post('/logout', isLoggedIn, (req: Request, res: Response, next: NextFunction) => {
  req.logout();
  req.session.destroy(() => {
    res.status(200).json('success to logout');
  });
})

// get user todos 
userRouter.get('/:user_id/todos?', isLoggedIn, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.query.offset && req.query.limit) {
      if (req.query.offset > req.query.limit) {
        res.status(400).json('limit should be greater than offset')
      }
      if (req.user) {
        const user = await userModel.findUniqueUser({ id: req.user.id })
        if (!user) {
          res.status(400).json('invalid user')
        } else {
          const todoData = await todoModel.getUserTodo(Number(req.user.id), Number(req.query.offset), Number(req.query.limit))
          res.status(200).json(todoData[0])
        }
      }

    } else {
      res.status(400)
    }
  } catch (err) {
    console.error(err);
    next(err);
  }
})

export default userRouter
