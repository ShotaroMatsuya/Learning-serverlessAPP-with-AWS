import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs/Subject';

import { Observable } from 'rxjs/Observable';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';

// import 'cross-fetch/polyfill';
// import AmazonCognitoIdentity from 'amazon-cognito-identity-js';

import {
	CognitoUserPool,
	CognitoUserAttribute,
	CognitoUser,
  AuthenticationDetails,
  CognitoUserSession
} from 'amazon-cognito-identity-js';

import { User } from './user.model';

import {AWS_CONFIG} from '../../config/config.secret';

//defined config about aws cognito
const POOL_DATA = {
  UserPoolId:AWS_CONFIG.Pool,
  ClientId:AWS_CONFIG.Client
};

//create our pool object
const userPool = new CognitoUserPool(POOL_DATA);

@Injectable()
export class AuthService {
  authIsLoading = new BehaviorSubject<boolean>(false);
  authDidFail = new BehaviorSubject<boolean>(false);
  authStatusChanged = new Subject<boolean>();
  //add property about fetched user info form cognito
  registeredUser :CognitoUser;

  constructor(private router: Router) {}
  signUp(username: string, email: string, password: string): void {
    this.authIsLoading.next(true);
    const user: User = {
      username: username,
      email: email,
      password: password
    };
    //empty array of attrList
    const attrList: CognitoUserAttribute[] = [];
    //create email attribute
    const emailAttribute = {
      Name: 'email',
      Value: user.email
    };
    //pushing them to the list
    attrList.push(new CognitoUserAttribute(emailAttribute));
    //call up signUp method on the userPool object
    userPool.signUp(user.username,user.password,attrList,null,(err,result)=>{
      if(err){
        this.authDidFail.next(true);
        this.authIsLoading.next(false);
        console.log(err);
        return;
      }
      this.authDidFail.next(false);
      this.authIsLoading.next(false);
      //add populated data to property if it was successful
      this.registeredUser = result.user;
    });
    return;
  }
  confirmUser(username: string, code: string) {
    this.authIsLoading.next(true);
    //set userPool config
    const userData = {
      Username: username,
      Pool:userPool
    };
    const cognitUser = new CognitoUser(userData);
    //code is by application passing it in here from the form the user filled out,& set force creation alias to true
    cognitUser.confirmRegistration(code,true,(err,result)=>{
      if(err){
        this.authDidFail.next(true);
        this.authIsLoading.next(false);
        console.log(err);
        return;
      }
      this.authDidFail.next(false);
      this.authIsLoading.next(false);
      this.router.navigate(['/']);//redirect sign in page
    });
  }
  signIn(username: string, password: string): void {
    this.authIsLoading.next(true);
    const authData = {
      Username: username,
      Password: password
    };
    // pass the user input filled out from the form
    const authDetails = new AuthenticationDetails(authData);
    //set userPool config
    const userData = {
      Username:username,
      Pool:userPool
    };
    //pass the user data to initialize that user.
    const cognitoUser = new CognitoUser(userData);
    //pass the authentication details object together with an object
    const that = this;
    cognitoUser.authenticateUser(authDetails,{
      onSuccess(result:CognitoUserSession){
        that.authStatusChanged.next(true);
        that.authDidFail.next(false);
        that.authIsLoading.next(false);
        console.log(result);
      },
      onFailure(err){
        that.authDidFail.next(true);
        that.authIsLoading.next(false);
        console.log(err);
      }
    });
    this.authStatusChanged.next(true);
    return;
  }
  getAuthenticatedUser() {
    return userPool.getCurrentUser();
  }
  logout() {
    this.getAuthenticatedUser().signOut();
    this.authStatusChanged.next(false);
  }
  isAuthenticated(): Observable<boolean> {
    //retrieve current user from local-storage
    const user = this.getAuthenticatedUser();
    const obs = Observable.create((observer) => {
      if (!user) {
        observer.next(false);
      } else {
        user.getSession((err,session)=>{
          if(err){
            observer.next(false);
          }else{
            if(session.isValid()){
              observer.next(true);
            }else{
              observer.next(false);
            }
          }
        });
      }
      observer.complete();
    });
    return obs;
  }
  initAuth() {
    this.isAuthenticated().subscribe(
      (auth) => this.authStatusChanged.next(auth)
    );
  }
}
